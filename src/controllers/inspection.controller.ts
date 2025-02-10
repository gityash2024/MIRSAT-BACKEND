import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import InspectionLevel from '../models/InspectionLevel';
import { pick } from 'lodash';

export const createInspectionLevel = catchAsync(async (req: Request, res: Response) => {
  const inspectionData = {
    ...req.body,
    createdBy: req.user?._id,
    updatedBy: req.user?._id
  };
  const inspection = await InspectionLevel.create(inspectionData);
  res.status(httpStatus.CREATED).send(inspection);
});

export const getInspectionLevels = catchAsync(async (req: Request, res: Response) => {
  const filter: any = pick(req.query, ['name', 'type', 'status', 'priority']);
  const options: any = pick(req.query, ['sortBy', 'limit', 'page', 'populate']);
  const search = req.query.search as string;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  Object.keys(filter).forEach(key => {
    if (key !== '$or' && filter[key]) {
      if (Array.isArray(filter[key])) {
        filter[key] = { $in: filter[key] };
      } else {
        filter[key] = { $regex: filter[key], $options: 'i' };
      }
    }
  });

  const sortBy = options.sortBy?.split(',').join(' ') || '-createdAt';
  const limit = parseInt(options.limit) || 10;
  const page = parseInt(options.page) || 1;
  const skip = (page - 1) * limit;

  const [inspections, count] = await Promise.all([
    InspectionLevel.find(filter)
      .sort(sortBy)
      .limit(limit)
      .skip(skip)
      .populate(options.populate || '')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('assignedTasks', 'title description status'),
    InspectionLevel.countDocuments(filter)
  ]);

  res.send({
    results: inspections,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
  });
});

export const getInspectionLevel = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.inspectionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID is required');
  }

  const inspection = await InspectionLevel.findById(req.params.inspectionId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTasks', 'title description status');
    
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  res.send(inspection);
});

export const updateInspectionLevel = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.inspectionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID is required');
  }

  const inspection = await InspectionLevel.findById(req.params.inspectionId);
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  const updateData = {
    ...req.body,
    updatedBy: req.user?._id
  };

  Object.assign(inspection, updateData);
  await inspection.save();
  
  const updatedInspection = await InspectionLevel.findById(inspection._id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTasks', 'title description status');

  res.send(updatedInspection);
});

export const deleteInspectionLevel = catchAsync(async (req: Request, res: Response) => {
  if (!req.params.inspectionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID is required');
  }

  const inspection = await InspectionLevel.findById(req.params.inspectionId);
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  if (inspection.assignedTasks && inspection.assignedTasks.length > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST, 
      'Cannot delete inspection level with associated tasks'
    );
  }

  await inspection.deleteOne();
  res.status(httpStatus.NO_CONTENT).send();
});

export const updateSubLevel = catchAsync(async (req: Request, res: Response) => {
  const { inspectionId, subLevelId } = req.params;
  
  if (!inspectionId || !subLevelId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID and Sub Level ID are required');
  }

  const inspection = await InspectionLevel.findById(inspectionId);
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  const subLevel = inspection.subLevels.id(subLevelId);
  if (!subLevel) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Sub level not found');
  }

  Object.assign(subLevel, req.body);
  inspection.updatedBy = req.user?._id;
  await inspection.save();

  const updatedInspection = await InspectionLevel.findById(inspectionId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTasks', 'title description status');

  res.send(updatedInspection);
});

export const reorderSubLevels = catchAsync(async (req: Request, res: Response) => {
  const { inspectionId } = req.params;
  const { newOrder } = req.body;

  if (!inspectionId || !newOrder) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Inspection ID and new order are required');
  }

  const inspection = await InspectionLevel.findById(inspectionId);
  if (!inspection) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  newOrder.forEach((id: string, index: number) => {
    const subLevel = inspection.subLevels.id(id);
    if (subLevel) {
      subLevel.order = index;
    }
  });

  inspection.updatedBy = req.user?._id;
  await inspection.save();

  const updatedInspection = await InspectionLevel.findById(inspectionId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .populate('assignedTasks', 'title description status');

  res.send(updatedInspection);
});