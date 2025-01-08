import { Request } from 'express';
import { IUser } from '../models/User';

export interface IAuthRequest extends Request {
  user?: IUser;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions?: string[];
}

export interface IForgotPasswordRequest {
  email: string;
}

export interface IResetPasswordRequest {
  token: string;
  password: string;
}