import mongoose from 'mongoose';
import 'dotenv/config';
import { User } from '../models/User';

async function updateAdminPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mirsat');
    console.log('Connected to MongoDB');

    // Update the admin user with the new permissions
    const result = await User.updateOne(
      { email: 'admin@mirsat.com' },
      { $addToSet: { permissions: { $each: ['getQuestionnaires', 'manageQuestionnaires'] } } }
    );

    console.log(`User updated: ${result.modifiedCount} document(s)`);
  } catch (error) {
    console.error('Error updating permissions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateAdminPermissions(); 