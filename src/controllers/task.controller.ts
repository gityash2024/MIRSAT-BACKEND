import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ApiError from '../utils/ApiError';

export const taskController = {
  // Get all tasks
  getTasks: catchAsync(async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      message: 'Get all tasks route'
    });
  }),

  // Create new task
  createTask: catchAsync(async (req: Request, res: Response) => {
    res.status(201).json({
      status: 'success',
      message: 'Create task route'
    });
  }),

  // Get single task
  getTask: catchAsync(async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      message: 'Get single task route'
    });
  }),

  // Update task
  updateTask: catchAsync(async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      message: 'Update task route'
    });
  }),

  // Delete task
  deleteTask: catchAsync(async (req: Request, res: Response) => {
    res.status(204).json({
      status: 'success',
      message: 'Delete task route'
    });
  })
};