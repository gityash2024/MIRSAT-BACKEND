import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  createdBy?: Schema.Types.ObjectId;
}

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Role description is required'],
    },
    permissions: [{
      type: String,
      required: true,
      enum: [
        'create_task',
        'edit_task',
        'delete_task',
        'view_task',
        'manage_users',
        'generate_reports',
        'manage_calendar',
        'configure_notifications'
      ]
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    }
  },
  {
    timestamps: true,
  }
);

export const Role = mongoose.model<IRole>('Role', roleSchema);