// In upload.service.ts
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';
interface CloudinaryStorageParams {
  folder: string;
  allowed_formats: string[];
  resource_type: string;
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mirsat-tasks',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'xlsx', 'xls'],
    resource_type: 'auto',
  } as CloudinaryStorageParams
});

// Create multer upload instance
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Service methods
export const uploadService = {
  async uploadFile(file: Express.Multer.File) {
    try {
      // Note: With CloudinaryStorage, file is already uploaded when it reaches this point
      // We just need to return the file information
      return {
        url: file.path, // CloudinaryStorage puts the secure_url in the path property
        filename: file.originalname,
        contentType: file.mimetype,
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw new ApiError('Error uploading file', 500);
    }
  },

  async deleteFile(publicId: string) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new ApiError('Error deleting file', 500);
    }
  },
};