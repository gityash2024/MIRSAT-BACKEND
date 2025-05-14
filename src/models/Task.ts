import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskProgress {
  subLevelId: mongoose.Types.ObjectId;
  status: 'pending' | 'in_progress' | 'completed' | 'full_compliance' | 'partial_compliance' | 'non_compliance' | 'not_applicable';
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: Schema.Types.ObjectId;
  notes?: string;
  photos?: string[];
  timeSpent?: number;
  signoff?: {
    signedBy: Schema.Types.ObjectId;
    signedAt: Date;
    comments?: string;
  };
}

export interface IQuestion {
  text: string;
  type: 'text' | 'number' | 'boolean' | 'multiple-choice' | 'checkbox' | 'date' | 'yesno' | 'select' | 'compliance';
  options?: string[];
  required: boolean;
}

export interface ITask extends Document {
  title: string;
  description: string;
  assignedTo: Schema.Types.ObjectId[];
  createdBy: Schema.Types.ObjectId;
  asset?: Schema.Types.ObjectId;
  status: 'pending' | 'in_progress' | 'completed' | 'incomplete' | 'partially_completed';
  priority: 'low' | 'medium' | 'high';
  deadline: Date;
  location?: string;
  inspectionLevel: any;
  progress: ITaskProgress[];
  overallProgress: number;
  preInspectionQuestions?: IQuestion[];
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
    comment: string;
    attachments?: {
      url: string;
      filename: string;
    }[];
    timestamp: Date;
  }[];
  isActive: boolean;
  taskMetrics?: {
    timeSpent: number;
    completionRate: number;
    subTasksCompleted: number;
    totalSubTasks: number;
    subLevelTimeSpent?: Record<string, number>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const taskProgressSchema = new Schema<ITaskProgress>({
  subLevelId: { type: Schema.Types.ObjectId, ref: 'InspectionLevel.subLevels' },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'full_compliance', 'partial_compliance', 'non_compliance', 'not_applicable'],
    default: 'pending'
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
  photos: [{ type: String }],
  timeSpent: { type: Number, default: 0 },
  signoff: {
    signedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    signedAt: { type: Date },
    comments: { type: String }
  }
});

const questionSchema = new Schema<IQuestion>({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'boolean', 'multiple-choice', 'checkbox', 'date', 'yesno', 'select', 'compliance'],
    default: 'text',
  },
  options: {
    type: [String],
    default: undefined,
  },
  required: {
    type: Boolean,
    default: true,
  },
});

const taskSchema = new Schema<ITask>({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
  },
  assignedTo: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  asset: {
    type: Schema.Types.ObjectId,
    ref: 'Asset',
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'incomplete', 'partially_completed'],
    default: 'pending',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  deadline: {
    type: Date,
    required: true,
  },
  location: {
    type: String,
  },
  inspectionLevel: {
    type: Schema.Types.ObjectId,
    ref: 'InspectionLevel',
    required: true,
  },
  progress: [taskProgressSchema],
  overallProgress: {
    type: Number,
    default: 0,
  },
  preInspectionQuestions: [questionSchema],
  attachments: [{
    url: String,
    filename: String,
    contentType: String,
  }],
  comments: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    attachments: [{
      url: String,
      filename: String,
    }],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  statusHistory: [{
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: String,
    attachments: [{
      url: String,
      filename: String,
    }],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
},
{
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
}
);

taskSchema.index({ status: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ deadline: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);