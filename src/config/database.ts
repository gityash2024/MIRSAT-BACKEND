import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { seedAdmin } from '../seeders/adminSeeder';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000, // Increase socket timeout for large operations
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    await seedAdmin();
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

export default connectDB;