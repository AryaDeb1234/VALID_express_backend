import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import Inspection, {
  IExtractedField,
  IInspection,
  IInspectionMetadata,
  IRuleResult,
  IReviewRequired,
  InspectionStatus,
  OverlayType,
} from '../models/Inspection';
import { config } from '../config/db';
import { uploadImage } from '../services/cloudinaryService';
import {
  createMockInspectionResult,
  InspectionMetadataPayload,
  processInspection,
  UploadedInspectionImage,
} from '../services/inspectionService';

type InspectionPayload = Record<string, any>;

const normalizeBbox = (bbox: unknown): number[] | null =>
  Array.isArray(bbox)
    ? bbox.map((coordinate) => Math.max(0, Math.min(1, Number(coordinate))))
    : null;

const toExtractedField = (value: any): IExtractedField => ({
  text: String(value?.text ?? value?.value ?? value ?? ''),
  confidence: Number(value?.confidence ?? 0),
  source: value?.source
    ? { ...value.source, bbox: normalizeBbox(value.source.bbox) }
    : null,
});

const mergedFieldNames = [
  'manufacturer',
  'mrp',
  'net_quantity',
  'packed_date',
  'customer_care',
  'country_of_origin',
] as const;

const normalizeMergedFields = (payload: InspectionPayload) => {
  const source = payload.merged_fields ?? payload.extracted_fields ?? {};
  return Object.fromEntries(
    mergedFieldNames.map((field) => [
      field,
      source[field] == null ? null : toExtractedField(source[field]),
    ])
  );
};

const normalizeRawOcrBoxes = (payload: InspectionPayload) =>
  (payload.raw_ocr_boxes ?? []).map((box: any) => ({
    bbox: normalizeBbox(box.bbox),
    text: String(box.text ?? ''),
    confidence: Number(box.confidence ?? 0),
    font_height_px: Number(box.font_height_px ?? 0),
  }));

const imageExtractedFieldNames = [
  'manufacturer',
  'manufacturer_name',
  'manufacturer_address',
  'net_quantity',
  'mrp',
  'packed_date',
  'customer_care',
  'country_of_origin',
] as const;

const normalizeImageExtractedFields = (payload: InspectionPayload) => {
  const source = payload.extracted_fields ?? {};

  return Object.fromEntries(
    imageExtractedFieldNames.map((field) => {
      const val = source[field];
      if (val == null) return [field, null];
      
      const extractedText = typeof val === 'object' ? (val.text ?? val.value ?? '') : val;
      return [field, String(extractedText)];
    })
  );
};

const normalizeImageData = (
  payload: InspectionPayload,
  uploadedFile: UploadedInspectionImage,
  imageUrl: string
) => ({
  url: imageUrl,
  filename: String(payload.filename ?? uploadedFile.originalname),
  image_dimensions: payload.image_dimensions,
  extracted_fields: normalizeImageExtractedFields(payload),
  raw_ocr_boxes: normalizeRawOcrBoxes(payload),
});

const normalizeRuleResults = (payload: InspectionPayload): IRuleResult[] =>
  (payload.ruleResults ?? payload.rule_results ?? payload.rules ?? []).map((rule: any) => {
    const passed = Boolean(rule.passed ?? rule.compliant ?? rule.status === 'PASS');
    const issue = rule.issue ?? rule.description ?? rule.message;
    return {
      ruleCode: String(rule.ruleCode ?? rule.rule_code ?? rule.rule_id ?? rule.code ?? 'UNKNOWN_RULE'),
      ruleName: String(rule.ruleName ?? rule.rule_name ?? rule.rule ?? rule.name ?? 'Unknown rule'),
      passed,
      severity: ['INFO', 'WARNING', 'ERROR'].includes(rule.severity)
        ? rule.severity
        : passed ? 'INFO' : 'ERROR',
      issue: issue == null ? null : String(issue),
      field: rule.field == null ? null : String(rule.field),
    };
  });

const normalizeReviewRequired = (payload: InspectionPayload): IReviewRequired[] =>
  (payload.review_required ?? payload.reviewRequired ?? []).map((review: any) => ({
    rule_id: String(review.rule_id ?? review.ruleId ?? ''),
    rule_name: String(review.rule_name ?? review.ruleName ?? ''),
    category: String(review.category ?? ''),
    status: 'REVIEW',
    message: String(review.message ?? ''),
    severity: ['INFO', 'WARNING', 'ERROR', 'UNASSIGNED'].includes(review.severity)
      ? review.severity
      : 'UNASSIGNED',
    violation_code: String(review.violation_code ?? review.violationCode ?? ''),
    evidence: review.evidence && typeof review.evidence === 'object' ? review.evidence : {},
  }));

const normalizeOverlays = (payload: InspectionPayload) =>
  (payload.canvasOverlays ?? payload.canvas_overlays ?? payload.overlays ?? []).map((overlay: any) => {
    const imageType = ['front', 'back', 'side'].includes(overlay.image_type)
      ? overlay.image_type
      : overlay.image ?? overlay.imageType;

    return {
      ...(imageType ? { image_type: imageType } : {}),
      bbox: normalizeBbox(overlay.bbox) ?? [],
      type: (['VIOLATION', 'REVIEW'].includes(overlay.type) ? overlay.type : 'VALID') as OverlayType,
      label: String(overlay.label ?? ''),
    };
  });

const normalizeMetadata = (body: InspectionPayload): IInspectionMetadata => ({
  product_category: String(body.product_category ?? body.productCategory ?? 'GENERAL'),
  is_imported: body.is_imported === true || body.is_imported === 'true'
    || body.isImported === true || body.isImported === 'true',
  is_perishable: body.is_perishable === true || body.is_perishable === 'true'
    || body.isPerishable === true || body.isPerishable === 'true',
  pdp_area_cm2: body.pdp_area_cm2 == null && body.pdpAreaCm2 == null
    ? null
    : Number(body.pdp_area_cm2 ?? body.pdpAreaCm2),
});

const violationsFromRuleResults = (ruleResults: ReturnType<typeof normalizeRuleResults>) =>
  ruleResults
    .filter((rule) => !rule.passed)
    .map((rule) => ({
      code: rule.ruleCode,
      rule: rule.ruleCode,
      field: rule.field,
      description: rule.issue ?? `${rule.ruleName} failed.`,
      severity: rule.severity === 'WARNING' ? 'WARNING' as const : 'ERROR' as const,
    }));

const legalActionCitationByCode: Record<string, {
  law: string;
  section: string; 
  recommendedAction: string;
}> = { 
  MRP_UNCLEAR: {
    law: 'Legal Metrology Act, 2009',
    section: 'Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6',
    recommendedAction: 'Verify the maximum retail price declaration before sale.',
  },
};

const getLegalActionCitations = (violations: IInspection['violations']) =>
  (violations ?? []).map((violation) => ({
    violationCode: violation.code,
    citation: legalActionCitationByCode[violation.code] ?? {
      law: 'Applicable consumer protection and legal metrology regulations',
      section: 'To be determined during legal review',
      recommendedAction: 'Refer the violation for officer and legal review.',
    },
  })); 

export const scanInspection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('🔥🔥🔥 SCAN CONTROLLER WAS HIT 🔥🔥🔥');
  try {
    console.log('🔥 SCAN CONTROLLER HIT');
    console.log('🔥 MOCK VALUE:', config.useMockInspectionService);
    console.log(
      '🔥 MODE:',
      config.useMockInspectionService ? 'MOCK' : 'PYTHON'
    );
    console.log(`Inspection request mode: ${config.useMockInspectionService ? 'MOCK' : 'PYTHON'}`);
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageFields = ['front', 'back', 'side'] as const;
    const missing = imageFields.filter((field) => !files?.[field]?.[0]);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required image(s): ${missing.join(', ')}`,
      });
    }

    const uploadedFiles: UploadedInspectionImage[] = imageFields.map((field) => {
      const file = files![field][0];
      return {
        fieldName: field,
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      };
    });

    const inspectionObjectId = new mongoose.Types.ObjectId();
    const imageUrls = config.useMockInspectionService
      ? imageFields.map((field) => `mock://inspection/${inspectionObjectId}/${field}`)
      : await Promise.all(uploadedFiles.map((file) => uploadImage(file.buffer)));
    const metadata = normalizeMetadata(req.body) as InspectionMetadataPayload;
    const compliance: InspectionPayload = config.useMockInspectionService
      ? createMockInspectionResult()
      : await processInspection(
          uploadedFiles,
          metadata,
          String(req.body.productName ?? '')
        );
    const extractedPayload = compliance;
    const score = Number(compliance.complianceScore ?? compliance.compliance_score ?? compliance.score ?? 0);
    const status: InspectionStatus = compliance.status === 'NON_COMPLIANT'
      ? 'NON-COMPLIANT'
      : compliance.status as InspectionStatus;

    const extractedImages = extractedPayload.images ?? {};
    const ruleResults = normalizeRuleResults(compliance);
    const reviewRequired = normalizeReviewRequired(compliance);
    const inspection = await Inspection.create({
      _id: inspectionObjectId,
      officerId: new mongoose.Types.ObjectId(req.userId),
      productName: String(req.body.productName ?? compliance.productName ?? 'Unknown Product'),
      metadata: compliance.metadata ?? metadata,
      images: Object.fromEntries(imageFields.map((field, index) => [
        field,
        normalizeImageData(
          extractedImages[field] ?? {},
          uploadedFiles[index],
          imageUrls[index]
        ),
      ])),
      merged_fields: normalizeMergedFields(extractedPayload),
      complianceScore: score,
      status,
      ruleResults,
      review_required: reviewRequired,
      canvasOverlays: normalizeOverlays(compliance),
      violations: violationsFromRuleResults(ruleResults),
    });

    return res.status(201).json({
      success: true,
      message: 'Inspection scanned successfully',
      data: {
        inspectionId: inspection._id.toString(),
        complianceScore: inspection.complianceScore,
        status: inspection.status,
        ruleResults: inspection.ruleResults,
        inspection,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getInspectionEvidence = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const inspection = await Inspection.findOne({
      _id: req.params.inspectionId,
      officerId: req.userId,
    }).select('images merged_fields canvasOverlays violations');

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        inspectionId: inspection._id.toString(),
        images: inspection.images,
        merged_fields: inspection.merged_fields,
        canvasOverlays: inspection.canvasOverlays,
        violations: inspection.violations,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getInspectionHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const inspections = await Inspection.find({ officerId: req.userId })
      .select('productName createdAt status complianceScore')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: inspections.map((inspection) => ({
        inspection_id: inspection._id.toString(),
        product_name: inspection.productName,
        date: inspection.createdAt,
        status: inspection.status,
        compliance_score: inspection.complianceScore,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export const getInspectionReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const inspection = await Inspection.findOne({
      _id: req.params.inspectionId,
      officerId: req.userId,
    })
      .populate('officerId', 'officerId name email phone')
      .lean();

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection not found',
      });
    }

    const officer = inspection.officerId as unknown as {
      _id: mongoose.Types.ObjectId;
      officerId: string;
      name: string;
      email: string;
      phone?: string;
    };

    return res.status(200).json({
      success: true,
      data: {
        reportTitle: 'Product Compliance Inspection Report',
        generatedAt: new Date().toISOString(),
        inspection: {
          id: inspection._id,
          status: inspection.status,
          complianceScore: inspection.complianceScore,
          createdAt: inspection.createdAt,
          updatedAt: inspection.updatedAt,
        },
        officer: {
          id: officer._id,
          officerId: officer.officerId,
          name: officer.name,
          email: officer.email,
          phone: officer.phone ?? null,
        },
        product: {
          name: inspection.productName,
          images: inspection.images,
          merged_fields: inspection.merged_fields,
        },
        compliance: {
          ruleResults: inspection.ruleResults,
          violations: inspection.violations,
          legalActionCitations: getLegalActionCitations(inspection.violations),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};
