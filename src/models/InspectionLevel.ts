import mongoose, { Schema, Document } from 'mongoose';

export interface ISubLevel {
  name: string;
  description: string;
  order: number;
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: Schema.Types.ObjectId;
}

export interface IInspectionLevel extends Document {
  name: string;
  description: string;
  type: 'safety' | 'environmental' | 'operational' | 'quality';
  status: 'active' | 'inactive' | 'draft' | 'archived';
  priority: 'high' | 'medium' | 'low';
  subLevels: any;
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subLevelSchema = new Schema<ISubLevel>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  order: { type: Number, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

const inspectionLevelSchema = new Schema<IInspectionLevel>({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['safety', 'environmental', 'operational', 'quality']
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
  subLevels: [subLevelSchema],
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