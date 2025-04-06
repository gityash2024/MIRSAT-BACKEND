// models/Asset.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  uniqueId: number;
  type: string;
  displayName: string;
  city: string;
  location: string;
  createdBy: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const assetSchema = new Schema<IAsset>(
  {
    uniqueId: {
      type: Number,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

assetSchema.index({ uniqueId: 1 });
assetSchema.index({ type: 1 });
assetSchema.index({ city: 1 });
assetSchema.index({ location: 1 });

export const Asset = mongoose.model<IAsset>('Asset', assetSchema);