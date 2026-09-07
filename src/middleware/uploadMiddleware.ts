import multer from 'multer';

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

const imageFileFilter: multer.Options['fileFilter'] = (req, file, callback) => {
  if (!imageTypes.includes(file.mimetype)) {
    return callback(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }

  callback(null, true);
};

export const uploadProfileImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

export const uploadInspectionImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: imageFileFilter,
});