import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  //dbUrl: process.env.DATABASE_URL || 'mongodb://localhost:27017/test',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-me',
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  useMockInspectionService: ['true', '1'].includes(
    process.env.USE_MOCK_INSPECTION_SERVICE?.trim().toLowerCase() ?? ''
  ), 
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '', 
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '', 
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || ''
};
