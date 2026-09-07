import { Router } from 'express';
import * as InspectionController from '../controllers/InspectionController';
import { authenticate } from '../middleware/authMiddleware';
import { uploadInspectionImages } from '../middleware/uploadMiddleware';

const router = Router();

router.post(
  '/scan',
  authenticate,
  uploadInspectionImages.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
    { name: 'side', maxCount: 1 },
  ]),
  InspectionController.scanInspection
); 

router.get(
  '/history',
  authenticate,
  InspectionController.getInspectionHistory
);

router.get(
  '/:inspectionId/evidence',
  authenticate,
  InspectionController.getInspectionEvidence
);

router.get(
  '/:inspectionId/report',
  authenticate,
  InspectionController.getInspectionReport
);

export default router;
