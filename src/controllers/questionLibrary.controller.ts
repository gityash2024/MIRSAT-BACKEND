import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import QuestionLibrary from '../models/QuestionLibrary';
import { pick } from 'lodash';

export const addQuestionToLibrary = catchAsync(async (req: Request, res: Response) => {
  // Check if already exists
  const existingQuestion = await QuestionLibrary.findOne({ text: req.body.text });
  
  if (existingQuestion) {
    return res.status(httpStatus.OK).send({
      message: 'Question already exists in library',
      data: existingQuestion
    });
  }
  
  const questionData = {
    ...req.body,
    createdBy: req.user?._id
  };
  
  const question = await QuestionLibrary.create(questionData);
  
  return res.status(httpStatus.CREATED).send({
    message: 'Question added to library successfully',
    data: question
  });
});

export const getQuestionLibrary = catchAsync(async (req: Request, res: Response) => {
  const filter = {};
  const options: any = pick(req.query, ['sortBy', 'limit', 'page']);
  const search = req.query.search as string;

  if (search) {
    Object.assign(filter, { text: { $regex: search, $options: 'i' } });
  }

  const sortBy = options.sortBy?.split(',').join(' ') || '-createdAt';
  const limit = parseInt(options.limit) || 100;
  const page = parseInt(options.page) || 1;
  const skip = (page - 1) * limit;

  const [questions, count] = await Promise.all([
    QuestionLibrary.find(filter)
      .sort(sortBy)
      .limit(limit)
      .skip(skip)
      .populate('createdBy', 'name email'),
    QuestionLibrary.countDocuments(filter)
  ]);

  return res.send({
    results: questions,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    totalResults: count,
  });
});

export const deleteQuestionFromLibrary = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const question = await QuestionLibrary.findById(id);
  
  if (!question) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Question not found in library');
  }
  
  await question.deleteOne();
  
  return res.status(httpStatus.NO_CONTENT).send();
}); 