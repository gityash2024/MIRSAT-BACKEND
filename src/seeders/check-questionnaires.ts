import mongoose from 'mongoose';
import 'dotenv/config';
import Questionnaire from '../models/questionnaire.model';

async function checkQuestionnaires() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mirsat');
    console.log('Connected to MongoDB');

    // Count questionnaires
    const count = await Questionnaire.countDocuments();
    console.log(`Number of questionnaires in database: ${count}`);

    // Get inspection questions for comparison
    const db = mongoose.connection.db;
    const inspectionLevels = db.collection('inspectionlevels');
    const inspectionCount = await inspectionLevels.countDocuments();
    console.log(`Number of inspection levels in database: ${inspectionCount}`);

    // List one questionnaire if available
    if (count > 0) {
      const questionnaire = await Questionnaire.findOne().lean();
      console.log('Sample questionnaire:', JSON.stringify(questionnaire, null, 2));
    }
  } catch (error) {
    console.error('Error checking questionnaires:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkQuestionnaires(); 