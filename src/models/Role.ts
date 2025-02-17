import mongoose, { Schema, Document } from 'mongoose';
import { PERMISSIONS } from '../utils/permissions';

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
      enum: Object.values(PERMISSIONS).flatMap(group => Object.values(group))
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