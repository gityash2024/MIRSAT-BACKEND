import mongoose from 'mongoose';
import 'dotenv/config';
import Questionnaire from '../models/questionnaire.model';
import { User } from '../models/User';

async function createSampleQuestionnaire() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mirsat');
    console.log('Connected to MongoDB');

    // Find admin user to set as creator
    const admin = await User.findOne({ email: 'admin@mirsat.com' });
    
    if (!admin) {
      console.error('Admin user not found!');
      return;
    }

    // Create a sample questionnaire
    const sampleQuestionnaire = {
      title: 'Safety Inspection Questionnaire',
      description: 'A standard safety inspection questionnaire for marine operations',
      category: 'safety',
      status: 'published',
      createdBy: admin._id,
      questions: [
        {
          text: 'Is there ISO 45001 Certificate?',
          type: 'multiple-choice',
          required: true,
          options: ['Yes', 'No']
        },
        {
          text: 'Is the Marina in good condition?',
          type: 'multiple-choice',
          required: true,
          options: ['Yes', 'No']
        },
        {
          text: 'Are all safety procedures being followed?',
          type: 'multiple-choice',
          required: true,
          options: ['Yes', 'No']
        }
      ],
      metadata: {
        usedInTemplates: 0,
        lastUpdated: new Date()
      }
    };

    const result = await Questionnaire.create(sampleQuestionnaire);
    console.log('Sample questionnaire created:', result._id);
  } catch (error) {
    console.error('Error creating sample questionnaire:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createSampleQuestionnaire(); 