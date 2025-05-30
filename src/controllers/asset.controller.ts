// controllers/asset.controller.ts
import { Request, Response, NextFunction } from 'express';
import { Asset } from '../models/Asset';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import ExcelJS from 'exceljs';

export const createAsset = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { uniqueId, type, displayName, city, location } = req.body;

  const existingAsset = await Asset.findOne({ uniqueId });
  if (existingAsset) {
    return next(new ApiError('Asset with this ID already exists', 400));
  }

  
  const asset = await Asset.create({
    uniqueId,
    type,
    displayName,
    city,
    location,
    createdBy: req.user!._id,
  });

  res.status(201).json({
    success: true,
    data: asset,
  });
});

export const getAssets = catchAsync(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search, type, city, location } = req.query;
  
  const query: any = { isActive: true };
  
  if (search) {
    query.$or = [
      { displayName: { $regex: search, $options: 'i' } },
      { type: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
    ];
  }
  
  if (type) {
    query.type = type;
  }

  if (city) {
    query.city = city;
  }

  if (location) {
    query.location = location;
  }

  const pageNumber = parseInt(page as string, 10);
  const limitNumber = parseInt(limit as string, 10);
  
  const assets = await Asset.find(query)
    .populate('createdBy', 'name email')
    .sort({ uniqueId: 1 })
    .skip((pageNumber - 1) * limitNumber)
    .limit(limitNumber);
  
  const total = await Asset.countDocuments(query);

  res.status(200).json({
    success: true,
    count: assets.length,
    total,
    page: pageNumber,
    totalPages: Math.ceil(total / limitNumber),
    data: assets,
  });
});

export const getAsset = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const asset = await Asset.findById(req.params.id)
    .populate('createdBy', 'name email');
  
  if (!asset) {
    return next(new ApiError('Asset not found', 404));
  }

  res.status(200).json({
    success: true,
    data: asset,
  });
});

export const updateAsset = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { uniqueId, type, displayName, city, location } = req.body;
  
  let asset = await Asset.findById(req.params.id);
  
  if (!asset) {
    return next(new ApiError('Asset not found', 404));
  }
  
  if (uniqueId !== asset.uniqueId) {
    const existingAsset = await Asset.findOne({ uniqueId, _id: { $ne: req.params.id } });
    if (existingAsset) {
      return next(new ApiError('Asset with this ID already exists', 400));
    }
  }
  
  asset = await Asset.findByIdAndUpdate(
    req.params.id,
    {
      uniqueId,
      type,
      displayName,
      city,
      location,
      updatedBy: req.user!._id,
    },
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    success: true,
    data: asset,
  });
});

export const deleteAsset = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const asset = await Asset.findByIdAndUpdate(
    req.params.id,
    {
      isActive: false,
      updatedBy: req.user!._id,
    },
    { new: true }
  );
  
  if (!asset) {
    return next(new ApiError('Asset not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: {},
  });
});

export const exportAssets = catchAsync(async (req: Request, res: Response) => {
  const assets = await Asset.find({ isActive: true })
    .populate('createdBy', 'name email')
    .sort({ uniqueId: 1 });
    
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Assets');
  
  worksheet.columns = [
    { header: 'Unique ID', key: 'uniqueId', width: 15 },
    { header: 'Type', key: 'type', width: 25 },
    { header: 'Display name', key: 'displayName', width: 30 },
    { header: 'City', key: 'city', width: 25 },
    { header: 'Location', key: 'location', width: 30 }
  ];
  
  assets.forEach(asset => {
    worksheet.addRow({
      uniqueId: asset.uniqueId,
      type: asset.type,
      displayName: asset.displayName,
      city: asset.city,
      location: asset.location
    });
  });
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A237E' }
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=assets.xlsx');
  
  await workbook.xlsx.write(res);
});