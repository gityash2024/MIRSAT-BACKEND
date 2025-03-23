import { Schema, model, Document } from 'mongoose';

export interface IQuestionLibrary extends Document {
  text: string;
  answerType: string;
  options?: string[];
  required: boolean;
  createdBy: Schema.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

const questionLibrarySchema = new Schema<IQuestionLibrary>(
  {
    text: { 
      type: String, 
      required: true,
      trim: true 
    },
    answerType: { 
      type: String, 
      required: true,
      enum: ['yesno', 'text', 'number', 'select', 'multiple_choice', 'compliance']
    },
    options: [{ type: String }],
    required: { 
      type: Boolean, 
      default: true 
    },
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    }
  },
  {
    timestamps: true
  }
);

// Create a unique index on text to prevent duplicate questions
questionLibrarySchema.index({ text: 1 }, { unique: true });

const QuestionLibrary = model<IQuestionLibrary>('QuestionLibrary', questionLibrarySchema);

export default QuestionLibrary; 