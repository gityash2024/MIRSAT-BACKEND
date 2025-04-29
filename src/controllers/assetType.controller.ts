// controllers/assetType.controller.ts
import { Request, Response, NextFunction } from 'express';
import { AssetType } from '../models/AssetType';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';

export const createAssetType = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name } = req.body;

  const existingAssetType = await AssetType.findOne({ name });
  if (existingAssetType) {
    return next(new ApiError('Asset type with this name already exists', 400));
  }

  const assetType = await AssetType.create({
    name,
    createdBy: req.user!._id,
  });

  res.status(201).json({
    success: true,
    data: assetType,
  });
});

export const getAssetTypes = catchAsync(async (req: Request, res: Response) => {
  const assetTypes = await AssetType.find({ isActive: true })
    .sort({ name: 1 });

  res.status(200).json({
    success: true,
    count: assetTypes.length,
    data: assetTypes,
  });
});

export const getAssetType = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const assetType = await AssetType.findById(req.params.id);
  
  if (!assetType) {
    return next(new ApiError('Asset type not found', 404));
  }

  res.status(200).json({
    success: true,
    data: assetType,
  });
});

export const updateAssetType = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name } = req.body;
  
  let assetType = await AssetType.findById(req.params.id);
  
  if (!assetType) {
    return next(new ApiError('Asset type not found', 404));
  }
  
  if (name !== assetType.name) {
    const existingAssetType = await AssetType.findOne({ name, _id: { $ne: req.params.id } });
    if (existingAssetType) {
      return next(new ApiError('Asset type with this name already exists', 400));
    }
  }
  
  assetType = await AssetType.findByIdAndUpdate(
    req.params.id,
    {
      name,
      updatedBy: req.user!._id,
    },
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    data: assetType,
  });
});

export const deleteAssetType = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const assetType = await AssetType.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
      updatedBy: req.user!._id,
    },
    { new: true }
  );
  
  if (!assetType) {
    return next(new ApiError('Asset type not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: {},
  });
});