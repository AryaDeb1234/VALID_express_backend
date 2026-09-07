import mongoose from 'mongoose';
import { config } from '../config/db';
import Inspection from '../models/Inspection';
import { User } from '../models/User';

const seedInspections = async () => {
  await mongoose.connect(config.dbUrl);

  const officer = await User.findOne().select('_id');
  if (!officer) {
    throw new Error('Create at least one user before seeding inspections.');
  }

  // Remove the unique index left behind by the old inspectionId field.
  try {
    await Inspection.collection.dropIndex('inspectionId_1');
  } catch (error: any) {
    if (error.codeName !== 'IndexNotFound' && error.code !== 27) {
      throw error;
    }
  }

  await Inspection.deleteMany({ productName: /^Mock Product [1-5]$/ });

  const inspections = Array.from({ length: 5 }, (_, index) => {
    const productNumber = index + 1;
    const compliant = productNumber % 2 === 1;

    return {
      officerId: officer._id,
      productName: `Mock Product ${productNumber}`,
      metadata: {
        product_category: 'GENERAL',
        is_imported: false,
        is_perishable: false,
        pdp_area_cm2: null,
      },
      images: {
        front: {
          filename: `mock-inspection-${productNumber}-front.jpg`,
          image_dimensions: { width: 1920, height: 1080 },
          extracted_fields: {
            manufacturer_name: `Mock Manufacturer ${productNumber}`,
            mrp: `₹${100 + productNumber * 10}`,
            net_quantity: `${productNumber * 100} g`,
            packed_date: `0${productNumber}/2026`,
            customer_care: '1800-000-000',
          },
          paddleocr_fields: {},
          raw_ocr_boxes: [],
        },
        back: { filename: `mock-inspection-${productNumber}-back.jpg`, image_dimensions: { width: 1920, height: 1080 }, extracted_fields: {}, paddleocr_fields: {}, raw_ocr_boxes: [] },
        side: { filename: `mock-inspection-${productNumber}-side.jpg`, image_dimensions: { width: 1920, height: 1080 }, extracted_fields: {}, paddleocr_fields: {}, raw_ocr_boxes: [] },
      },
      merged_fields: {
        manufacturer: { text: `Mock Manufacturer ${productNumber}`, confidence: 0.98, source: { image: 'front' } },
        mrp: { text: `₹${100 + productNumber * 10}`, confidence: 0.96, source: { image: 'front' } },
        net_quantity: { text: `${productNumber * 100} g`, confidence: 0.95, source: { image: 'front' } },
        packed_date: { text: `0${productNumber}/2026`, confidence: 0.94, source: { image: 'front' } },
        customer_care: { text: '1800-000-000', confidence: 0.97, source: { image: 'front' } },
      },
      complianceScore: compliant ? 100 : 62,
      status: compliant ? 'COMPLIANT' : 'NON-COMPLIANT',
      ruleResults: [
        {
          ruleCode: 'IMAGES_RECEIVED',
          ruleName: 'Required product images received',
          passed: true,
          severity: 'INFO' as const,
          issue: null,
          field: null,
        },
        {
          ruleCode: 'MANDATORY_LABEL',
          ruleName: 'Mandatory label information present',
          passed: compliant,
          severity: compliant ? 'INFO' as const : 'ERROR' as const,
          issue: compliant ? null : 'MRP label requires verification',
          field: compliant ? null : 'mrp',
        },
      ],
      canvasOverlays: compliant
        ? []
        : [
            {
              image_type: 'front' as const,
              bbox: [0.1667, 0.1667, 0.3958, 0.3333],
              type: 'VIOLATION' as const,
              label: 'MRP requires verification',
            },
          ],
      violations: compliant
        ? []
        : [
            {
              code: 'MRP_UNCLEAR',
              rule: 'MANDATORY_LABEL',
              field: 'mrp',
              description: 'MRP text is unclear or incomplete.',
              severity: 'ERROR' as const,
            },
          ],
    };
  });

  const created = await Inspection.insertMany(inspections);
  console.log(`Inserted ${created.length} mock inspections for officer ${officer._id}.`);
};

seedInspections()
  .catch((error) => {
    console.error('Failed to seed inspections:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
