import { config } from '../config/db';

export type UploadedInspectionImage = {
  fieldName: string;
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

export interface InspectionMetadataPayload {
  product_category: string;
  is_imported: boolean;
  is_perishable: boolean;
  pdp_area_cm2: number | null;
}

export interface PythonInspectionResponse {
  [key: string]: unknown;
  data?: PythonInspectionResponse;
  detail?: string;
  message?: string;
  metadata?: InspectionMetadataPayload;
  images?: Record<string, unknown>;
  merged_fields?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  ruleResults?: unknown[];
  review_required?: unknown[];
  reviewRequired?: unknown[];
  canvasOverlays?: unknown[];
  violations?: unknown[];
  complianceScore?: number;
  status?: string;
}

export const createMockInspectionResult = () => ({
  images: {
    front: {
      filename: 'mock-front.jpg',
      image_dimensions: { width: 1920, height: 1080 },
      extracted_fields: {
        manufacturer_name: 'Test Manufacturer',
        mrp: '₹100',
        net_quantity: '500 g',
        packed_date: '08/2026',
        customer_care: '1800-000-000',
      },
      paddleocr_fields: {
        manufacturer: { text: 'Test Manufacturer', confidence: 1 },
        mrp: { text: '₹100', confidence: 1 },
        net_quantity: { text: '500 g', confidence: 1 },
        packed_date: { text: '08/2026', confidence: 1 },
        customer_care: { text: '1800-000-000', confidence: 1 },
      },
      raw_ocr_boxes: [],
    },
    back: { filename: 'mock-back.jpg', image_dimensions: { width: 1920, height: 1080 }, extracted_fields: {}, paddleocr_fields: {}, raw_ocr_boxes: [] },
    side: { filename: 'mock-side.jpg', image_dimensions: { width: 1920, height: 1080 }, extracted_fields: {}, paddleocr_fields: {}, raw_ocr_boxes: [] },
  },
  merged_fields: {
    manufacturer: { text: 'Test Manufacturer', confidence: 1, source: { image: 'front', filename: 'mock-front.jpg' } },
    mrp: { text: '₹100', confidence: 1, source: { image: 'front', filename: 'mock-front.jpg' } },
    net_quantity: { text: '500 g', confidence: 1, source: { image: 'front', filename: 'mock-front.jpg' } },
    packed_date: { text: '08/2026', confidence: 1, source: { image: 'front', filename: 'mock-front.jpg' } },
    customer_care: { text: '1800-000-000', confidence: 1, source: { image: 'front', filename: 'mock-front.jpg' } },
  },
  image_dimensions: { width: 1920, height: 1080 },
  complianceScore: 100,
  status: 'COMPLIANT',
  summary: {
    total_rules: 1,
    passed: 1,
    violations: 0,
    review_required: 0,
    not_applicable: 0,
  },
  ruleResults: [
    { ruleCode: 'IMAGES_RECEIVED', ruleName: 'Required product images received', passed: true, severity: 'INFO', issue: null, field: null },
  ],
  canvasOverlays: [],
  violations: [],
});

export const processInspection = async (
  images: UploadedInspectionImage[],
  metadata: InspectionMetadataPayload,
  productName?: string
): Promise<PythonInspectionResponse> => {
  const form = new FormData();

  form.append('product_category', metadata.product_category);
  form.append('is_imported', String(metadata.is_imported));
  form.append('is_perishable', String(metadata.is_perishable));
  form.append('pdp_area_cm2', metadata.pdp_area_cm2 == null ? '' : String(metadata.pdp_area_cm2));
  if (productName) {
    form.append('product_name', productName);
  }

  for (const image of images) {
    const bytes = new Uint8Array(image.buffer.byteLength);
    image.buffer.copy(bytes);
    form.append(
      image.fieldName,
      new Blob([bytes], { type: image.mimetype }),
      image.originalname
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000);

  try {
    const response = await fetch(`${config.pythonServiceUrl}/extract-product`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as PythonInspectionResponse;
    if (!response.ok) {
      throw Object.assign(
        new Error(body.detail || body.message || `Python service returned ${response.status}`),
        { statusCode: 502 }
      );
    }

    return body.data ?? body;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('Python inspection service timed out'), {
        statusCode: 504,
      });
    }
    throw error.statusCode
      ? error
      : Object.assign(new Error('Python inspection service is unavailable'), {
          statusCode: 502,
        });
  } finally {
    clearTimeout(timeout);
  }
};

