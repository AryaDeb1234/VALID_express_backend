import mongoose, { Schema } from 'mongoose';

export type InspectionStatus = 'PROCESSING' | 'COMPLIANT' | 'NON-COMPLIANT' | 'REVIEW';
export type OverlayType = 'VALID' | 'VIOLATION' | 'REVIEW';
export type RuleSeverity = 'INFO' | 'WARNING' | 'ERROR';
export type ReviewSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'UNASSIGNED';
export type ImageType = 'front' | 'back' | 'side';

export interface IInspectionMetadata {
  product_category: string;
  is_imported: boolean;
  is_perishable: boolean;
  pdp_area_cm2?: number | null;
}

export interface IFieldSource {
  image?: string | null;
  filename?: string | null;
  bbox?: number[] | null; // normalized [x_min, y_min, x_max, y_max]
}

export interface IExtractedField {
  text: string;
  confidence: number;
  source?: IFieldSource | null;
}

export interface IRawOcrBox {
  bbox: number[] | null; // normalized [x_min, y_min, x_max, y_max]
  text: string;
  confidence: number;
  font_height_px: number;
}

export interface IImageExtractedFields {
  manufacturer?: string | null;
  manufacturer_name?: string | null;
  manufacturer_address?: string | null;
  net_quantity?: string | null;
  mrp?: string | null;
  packed_date?: string | null;
  customer_care?: string | null;
  country_of_origin?: string | null;
}

export interface IImageData {
  url?: string;
  filename?: string;
  image_dimensions?: {
    width: number;
    height: number;
  };
  extracted_fields?: IImageExtractedFields;
  raw_ocr_boxes?: IRawOcrBox[];
}

export interface IMergedFields {
  manufacturer?: IExtractedField | null;
  mrp?: IExtractedField | null;
  net_quantity?: IExtractedField | null;
  packed_date?: IExtractedField | null;
  customer_care?: IExtractedField | null;
  country_of_origin?: IExtractedField | null;
}

export interface IRuleResult {
  ruleCode: string;
  ruleName: string;
  passed: boolean;
  severity: RuleSeverity;
  issue?: string | null;
  field?: string | null;
}

export interface IReviewRequired {
  rule_id: string;
  rule_name: string;
  category: string;
  status: 'REVIEW';
  message: string;
  severity: ReviewSeverity;
  violation_code: string;
  evidence: Record<string, unknown>;
}

export interface ICanvasOverlay {
  image_type?: ImageType;
  bbox: number[]; // normalized [x_min, y_min, x_max, y_max]
  type: OverlayType;
  label: string;
}

export interface IViolation {
  code: string;
  rule?: string | null;
  field?: string | null;
  description: string;
  severity?: 'WARNING' | 'ERROR';
}

export interface IInspection {
  officerId: mongoose.Types.ObjectId;
  productName?: string;
  metadata: IInspectionMetadata;
  merged_fields: IMergedFields;
  images: { 
    front?: IImageData | null;
    back?: IImageData | null;
    side?: IImageData | null;
  };
  complianceScore?: number | null;
  status: InspectionStatus;
  ruleResults?: IRuleResult[];
  review_required?: IReviewRequired[];
  canvasOverlays?: ICanvasOverlay[];
  violations?: IViolation[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Schemas
const isNormalizedBbox = (bbox: number[] | null) =>
  bbox == null || (Array.isArray(bbox) && bbox.length === 4 && bbox.every((c) => c >= 0 && c <= 1));

const extractedFieldSchema = new Schema<IExtractedField>({
  text: { type: String, required: true },
  confidence: { type: Number, required: true },
  source: {
    image: { type: String, default: null },
    filename: { type: String, default: null },
    bbox: {
      type: [Number],
      default: null,
      validate: { validator: isNormalizedBbox, message: 'bbox must be [x_min, y_min, x_max, y_max] with values from 0 to 1' }
    }
  }
}, { _id: false });

const rawOcrBoxSchema = new Schema<IRawOcrBox>({
  bbox: {
    type: [Number],
    default: null,
    validate: { validator: isNormalizedBbox, message: 'bbox must be [x_min, y_min, x_max, y_max] with values from 0 to 1' }
  },
  text: { type: String, default: '' },
  confidence: { type: Number, default: 0 },
  font_height_px: { type: Number, default: 0 }
}, { _id: false });

const imageExtractedFieldsSchema = new Schema<IImageExtractedFields>({
  manufacturer: { type: String, default: null },
  manufacturer_name: { type: String, default: null },
  manufacturer_address: { type: String, default: null },
  net_quantity: { type: String, default: null },
  mrp: { type: String, default: null },
  packed_date: { type: String, default: null },
  customer_care: { type: String, default: null },
  country_of_origin: { type: String, default: null }
}, { _id: false });

const imageDataSchema = new Schema<IImageData>({
  url: { type: String, default: null },
  filename: { type: String },
  image_dimensions: {
    width: { type: Number },
    height: { type: Number }
  },
  extracted_fields: { type: imageExtractedFieldsSchema, default: () => ({}) },
  raw_ocr_boxes: [rawOcrBoxSchema]
}, { _id: false });

const ruleResultSchema = new Schema<IRuleResult>({
  ruleCode: { type: String, required: true },
  ruleName: { type: String, required: true },
  passed: { type: Boolean, required: true },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'ERROR'],
    required: true
  },
  issue: { type: String, default: null },
  field: { type: String, default: null }
}, { _id: false });

const reviewRequiredSchema = new Schema<IReviewRequired>({
  rule_id: { type: String, required: true },
  rule_name: { type: String, required: true },
  category: { type: String, required: true },
  status: { type: String, enum: ['REVIEW'], required: true },
  message: { type: String, required: true },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'ERROR', 'UNASSIGNED'],
    required: true
  },
  violation_code: { type: String, default: '' },
  evidence: { type: Schema.Types.Mixed, required: true, default: {} }
}, { _id: false });

const canvasOverlaySchema = new Schema<ICanvasOverlay>({
  image_type: { type: String, enum: ['front', 'back', 'side'], required: false },
  bbox: {
    type: [Number],
    required: true,
    validate: { validator: isNormalizedBbox, message: 'bbox must be [x_min, y_min, x_max, y_max] with values from 0 to 1' }
  },
  type: { type: String, enum: ['VALID', 'VIOLATION', 'REVIEW'], required: true },
  label: { type: String, required: true }
}, { _id: false });

const violationSchema = new Schema<IViolation>({
  code: { type: String, required: true },
  rule: { type: String, default: null },
  field: { type: String, default: null },
  description: { type: String, required: true },
  severity: {
    type: String,
    enum: ['WARNING', 'ERROR'],
    default: 'ERROR'
  }
}, { _id: false });




const inspectionSchema = new Schema<IInspection>({
  officerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productName: { type: String, default: 'Unknown Product' },
  metadata: {
    product_category: { type: String, default: 'GENERAL' },
    is_imported: { type: Boolean, default: false },
    is_perishable: { type: Boolean, default: false },
    pdp_area_cm2: { type: Number, default: null, min: 0 }
  },
  merged_fields: {
    manufacturer: { type: extractedFieldSchema, default: null },
    mrp: { type: extractedFieldSchema, default: null },
    net_quantity: { type: extractedFieldSchema, default: null },
    packed_date: { type: extractedFieldSchema, default: null },
    customer_care: { type: extractedFieldSchema, default: null },
    country_of_origin: { type: extractedFieldSchema, default: null }
  },
  images: {
    front: { type: imageDataSchema, default: null },
    back: { type: imageDataSchema, default: null },
    side: { type: imageDataSchema, default: null }
  },
  complianceScore: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['PROCESSING', 'COMPLIANT', 'NON-COMPLIANT', 'REVIEW'],
    default: 'PROCESSING'
  },
  ruleResults: [ruleResultSchema],
  review_required: { type: [reviewRequiredSchema], default: [] },
  canvasOverlays: [canvasOverlaySchema],
  violations: [violationSchema],
  
}, {
  timestamps: true
});

const Inspection = mongoose.model<IInspection>('Inspection', inspectionSchema);

export default Inspection;