import cloudinary from '../config/cloudinary';

export const uploadImage = (file: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'valid/profile-images', resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error('Image upload failed'));
        }

        resolve(result.secure_url);
      }
    );

    uploadStream.end(file);
  });
};