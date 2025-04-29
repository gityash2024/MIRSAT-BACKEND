import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../utils/catchAsync';
import ApiError from '../utils/ApiError';
import Questionnaire from '../models/questionnaire.model';
import { pick } from 'lodash';

interface IRequest extends Request {
  user: {
    id: string;
    [key: string]: any;
  };
}

/**
 * Create a questionnaire
 */
export const createQuestionnaire = catchAsync(async (req: IRequest, res: Response) => {
  const questionnaire = await Questionnaire.create({
    ...req.body,
    createdBy: req.user.id
  });
  res.status(httpStatus.CREATED).send(questionnaire);
});

/**
 * Get questionnaires with pagination
 */
export const getQuestionnaires = catchAsync(async (req: Request, res: Response) => {
  const filter: any = pick(req.query, ['title', 'category', 'status']);
  const options: any = pick(req.query, ['sortBy', 'limit', 'page']);
  const search = req.query.search as string;

  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  Object.keys(filter).forEach(key => {
    if (key !== '$or' && filter[key]) {
      filter[key] = { $regex: filter[key], $options: 'i' };
    }
  });

  const sortBy = options.sortBy?.split(',').join(' ') || '-createdAt';
  const limit = parseInt(options.limit as string) || 10;
  const page = parseInt(options.page as string) || 1;
  const skip = (page - 1) * limit;

  const [questionnaires, totalResults] = await Promise.all([
    Questionnaire.find(filter)
      .sort(sortBy)
      .limit(limit)
      .skip(skip)
      .populate('createdBy', 'name email')
      .lean(),
    Questionnaire.countDocuments(filter)
  ]);

  res.send({
    results: questionnaires,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  });
});

/**
 * Get a questionnaire by id
 */
export const getQuestionnaire = catchAsync(async (req: Request, res: Response) => {
  const questionnaire = await Questionnaire.findById(req.params.id)
    .populate('createdBy', 'name email')
    .lean();
    
  if (!questionnaire) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Questionnaire not found');
  }
  
  res.send(questionnaire);
});

/**
 * Update a questionnaire
 */
export const updateQuestionnaire = catchAsync(async (req: Request, res: Response) => {
  const questionnaire = await Questionnaire.findById(req.params.id);
  if (!questionnaire) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Questionnaire not found');
  }

  // Set last updated timestamp
  if (req.body.metadata) {
    req.body.metadata.lastUpdated = new Date();
  } else {
    req.body.metadata = {
      usedInTemplates: questionnaire.metadata?.usedInTemplates || 0,
      lastUpdated: new Date()
    };
  }

  Object.assign(questionnaire, req.body);
  await questionnaire.save();
  res.send(questionnaire);
});

/**
 * Delete a questionnaire
 */
export const deleteQuestionnaire = catchAsync(async (req: Request, res: Response) => {
  const questionnaire = await Questionnaire.findById(req.params.id);
  if (!questionnaire) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Questionnaire not found');
  }
  await questionnaire.deleteOne();
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Duplicate a questionnaire
 */
export const duplicateQuestionnaire = catchAsync(async (req: IRequest, res: Response) => {
  const questionnaire = await Questionnaire.findById(req.params.id);
  if (!questionnaire) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Questionnaire not found');
  }

  const questionnaireCopy = questionnaire.toObject();
  delete questionnaireCopy._id;
  delete questionnaireCopy.id;
  delete questionnaireCopy.createdAt;
  delete questionnaireCopy.updatedAt;
  
  questionnaireCopy.title = `${questionnaireCopy.title} (Copy)`;
  questionnaireCopy.status = 'draft';
  questionnaireCopy.createdBy = req.user.id;
  questionnaireCopy.metadata = {
    usedInTemplates: 0,
    lastUpdated: new Date()
  };

  const newQuestionnaire = await Questionnaire.create(questionnaireCopy);
  res.status(httpStatus.CREATED).send(newQuestionnaire);
});