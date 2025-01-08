import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipient: Schema.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'TASK_ASSIGNED',
        'TASK_UPDATED',
        'TASK_COMPLETED',
        'TASK_COMMENT',
        'STATUS_CHANGE',
        'DEADLINE_REMINDER',
        'ROLE_UPDATED',
        'SYSTEM_NOTIFICATION'
      ],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick lookups
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);