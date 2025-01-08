import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';
import {ApiError} from '../utils/ApiError';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mirsat-tasks',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
    resource_type: 'auto',
  } as any,
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError('Invalid file type', 400));
  }
};

// Create multer upload instance
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Service methods
export const uploadService = {
  async uploadFile(file: Express.Multer.File) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'auto',
        folder: 'mirsat-tasks',
      });

      return {
        url: result.secure_url,
        filename: file.originalname,
        contentType: file.mimetype,
      };
    } catch (error) {
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