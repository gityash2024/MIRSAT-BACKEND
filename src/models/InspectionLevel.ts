import mongoose, { Schema, Document } from 'mongoose';

export interface ISection {
  name: string;
  description: string;
  order: number;
  isCompleted?: boolean;
  completedAt?: Date;
  completedBy?: Schema.Types.ObjectId;
  questions?: IQuestion[];
  subLevels?: ISection[];
}

export interface IPage {
  name: string;
  description: string;
  order: number;
  isCompleted?: boolean;
  completedAt?: Date;
  completedBy?: Schema.Types.ObjectId;
  sections: ISection[];
}

export interface ISubLevel {
  name: string;
  description: string;
  order: number;
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: Schema.Types.ObjectId;
  subLevels?: ISubLevel[];
  questions?: IQuestion[];
}

export interface IQuestion {
  id?: string;
  _id?: string;
  text: string;
  answerType: string;
  options?: string[];
  required: boolean;
  levelId?: Schema.Types.ObjectId | string;
  description?: string;
  type?: string;
  scoring?: {
    enabled: boolean;
    max: number;
    weights?: Record<string, number>;
  };
  scores?: Record<string, number>;
  requirementType?: string;
  mandatory?: boolean;
}

export interface IInspectionSet {
  id?: string;
  _id?: string;
  name: string;
  description: string;
  subLevels: ISubLevel[];
  questions: IQuestion[];
  generalQuestions: IQuestion[];
}

export interface IInspectionLevel extends Document {
  name: string;
  description: string;
  type: 'safety' | 'environmental' | 'operational' | 'quality' | 'yacht_chartering' | 'marina_operator' | 'tourism_agent';
  status: 'active' | 'inactive' | 'draft' | 'archived';
  priority: 'high' | 'medium' | 'low';
  subLevels?: ISubLevel[];
  pages?: IPage[];
  sets?: IInspectionSet[];
  createdBy: Schema.Types.ObjectId;
  updatedBy: Schema.Types.ObjectId;
  completionCriteria: {
    requiredPhotos: boolean;
    requiredNotes: boolean;
    requiredSignoff: boolean;
  };
  assignedTasks: Schema.Types.ObjectId[];
  metrics: {
    completedTasks: number;
    activeInspectors: number;
    avgCompletionTime: number;
    complianceRate: number;
  };
  attachments: {
    url: string;
    filename: string;
    contentType: string;
  }[];
  comments: {
    user: Schema.Types.ObjectId;
    content: string;
    attachments?: {
      url: string;
      filename: string;
    }[];
    createdAt: Date;
  }[];
  statusHistory: {
    status: string;
    changedBy: Schema.Types.ObjectId;
    comment?: string;
    attachments?: {
      url: string;
      filename: string;
    }[];
    timestamp: Date;
  }[];
  questions: IQuestion[];
  questionnaireResponses?: Record<string, any>;
  questionnaireCompleted?: boolean;
  questionnaireNotes?: string;
  requirementType?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Define the question schema first
const questionSchema = new Schema({
  text: { type: String },
  description: { type: String, default: '' },
  answerType: String,
  type: String,
  options: [String],
  required: Boolean,
  levelId: { 
    type: Schema.Types.ObjectId, 
    ref: 'InspectionLevel',
    default: null
  },
  scoring: {
    enabled: Boolean,
    max: Number,
    weights: Schema.Types.Mixed
  },
  scores: Schema.Types.Mixed,
  requirementType: String,
  mandatory: Boolean
}, { 
  _id: true,
  strict: false // Allow additional fields not explicitly defined
});

// Now define section schema using the question schema
const sectionSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, default: 'No description provided' },
  order: { type: Number, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  questions: [questionSchema],
  subLevels: [{ type: Schema.Types.Mixed }]
});

const pageSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, default: 'No description provided' },
  order: { type: Number, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  sections: [sectionSchema]
});

const subLevelSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, default: 'No description provided' },
  order: { type: Number, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User' }
});

subLevelSchema.add({
  subLevels: [subLevelSchema],
  questions: [questionSchema]
});

subLevelSchema.set('toJSON', { virtuals: true });
subLevelSchema.set('toObject', { virtuals: true });

// Create schema for inspection sets
const inspectionSetSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, default: 'No description provided' },
  subLevels: [subLevelSchema],
  questions: [questionSchema],
  generalQuestions: [questionSchema]
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const inspectionLevelSchema = new Schema<IInspectionLevel>({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
 
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive', 'draft', 'archived'],
    default: 'active'
  },
  priority: {
    type: String,
    required: true,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  subLevels: [subLevelSchema], // Keep for backward compatibility
  pages: [pageSchema], // New structure
  sets: [inspectionSetSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  completionCriteria: {
    requiredPhotos: { type: Boolean, default: false },
    requiredNotes: { type: Boolean, default: false },
    requiredSignoff: { type: Boolean, default: false }
  },
  assignedTasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  metrics: {
    completedTasks: { type: Number, default: 0 },
    activeInspectors: { type: Number, default: 0 },
    avgCompletionTime: { type: Number, default: 0 },
    complianceRate: { type: Number, default: 0 }
  },
  attachments: [{
    url: String,
    filename: String,
    contentType: String
  }],
  comments: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    attachments: [{
      url: String,
      filename: String
    }],
    createdAt: { type: Date, default: Date.now }
  }],
  statusHistory: [{
    status: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment: String,
    attachments: [{
      url: String,
      filename: String
    }],
    timestamp: { type: Date, default: Date.now }
  }],
  questions: [questionSchema],
  questionnaireResponses: {
    type: Object,
    default: {}
  },
  questionnaireCompleted: {
    type: Boolean,
    default: false
  },
  questionnaireNotes: {
    type: String,
    default: ''
  },
  requirementType: {
    type: String,
    default: 'mandatory'
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

inspectionLevelSchema.index({ name: 1 });
inspectionLevelSchema.index({ type: 1 });
inspectionLevelSchema.index({ status: 1 });
inspectionLevelSchema.index({ createdBy: 1 });
inspectionLevelSchema.index({ priority: 1 });
inspectionLevelSchema.index({ isActive: 1 });

export default mongoose.model<IInspectionLevel>('InspectionLevel', inspectionLevelSchema);