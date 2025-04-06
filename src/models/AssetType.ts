// models/AssetType.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IAssetType extends Document {
  name: string;
  createdBy: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const assetTypeSchema = new Schema<IAssetType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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

assetTypeSchema.index({ name: 1 });

export const AssetType = mongoose.model<IAssetType>('AssetType', assetTypeSchema);