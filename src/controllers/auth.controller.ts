// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { catchAsync } from '../utils/catchAsync';
import ApiError from '../utils/ApiError';
import { UserModel, IUser } from '../models/User';

interface TokenPayload {
  id: string;
}

const generateToken = (id: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT secret is not defined');
  }
  return jwt.sign({ id } as TokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

export const authController = {
  register: catchAsync(async (req: Request, res: Response) => {
    const { firstName, lastName, email, password, role } = req.body;

    const userExists = await UserModel.findOne({ email });
    if (userExists) {
      throw new ApiError(400, 'User already exists');
    }

    const user = await UserModel.create({
      firstName,
      lastName,
      email,
      password,
      role
    });

    const token = generateToken(user._id.toString());
    const userResponse = user.toJSON();

    res.status(201).json({
      status: 'success',
      data: {
        user: userResponse,
        token
      }
    });
  }),

  login: catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Please provide email and password');
    }

    const user = await UserModel.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new ApiError(401, 'Incorrect email or password');
    }

    const token = generateToken(user._id.toString());
    const userResponse = user.toJSON();

    res.status(200).json({
      status: 'success',
      data: {
        user: userResponse,
        token
      }
    });
  }),

  forgotPassword: catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
      status: 'success',
      message: 'Password reset instructions sent to email'
    });
  }),

  resetPassword: catchAsync(async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      message: 'Password reset successful'
    });
  })
};