// src/controllers/user.controller.ts
import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import ApiError from '../utils/ApiError';
import { UserModel } from '../models/User';

export const userController = {
  getUsers: catchAsync(async (req: Request, res: Response) => {
    const users = await UserModel.find();
    res.status(200).json({
      status: 'success',
      data: { users }
    });
  }),

  createUser: catchAsync(async (req: Request, res: Response) => {
    const user = await UserModel.create(req.body);
    res.status(201).json({
      status: 'success',
      data: { user }
    });
  }),

  getUser: catchAsync(async (req: Request, res: Response) => {
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  }),

  updateUser: catchAsync(async (req: Request, res: Response) => {
    const user = await UserModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    res.status(200).json({
      status: 'success',
      data: { user }
    });
  }),

  deleteUser: catchAsync(async (req: Request, res: Response) => {
    const user = await UserModel.findByIdAndDelete(req.params.id);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    res.status(204).json({
      status: 'success',
      data: null
    });
  })
};