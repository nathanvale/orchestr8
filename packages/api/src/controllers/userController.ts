import type { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User.js';
import { registerSchema, loginSchema } from '../utils/validation.js';
import { generateToken } from '../utils/jwt.js';
import {
  ConflictError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
} from '../errors/ApiError.js';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = registerSchema.parse(req.body);

    const user = await UserModel.create(
      validatedData.email,
      validatedData.password,
      validatedData.name,
    );

    const userResponse = UserModel.toResponse(user);
    const token = generateToken(userResponse);

    res.status(201).json({
      id: userResponse.id,
      email: userResponse.email,
      name: userResponse.name,
      token,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return next(new ConflictError('Email already registered'));
      }
      if (error.name === 'ZodError') {
        return next(new ValidationError('Validation failed'));
      }
    }
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await UserModel.findByEmail(validatedData.email);
    if (!user) {
      return next(new AuthenticationError('Invalid email or password'));
    }

    const isValidPassword = await UserModel.verifyPassword(
      validatedData.password,
      user.passwordHash,
    );

    if (!isValidPassword) {
      return next(new AuthenticationError('Invalid email or password'));
    }

    const userResponse = UserModel.toResponse(user);
    const token = generateToken(userResponse);

    res.json({
      token,
      user: userResponse,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return next(new ValidationError('Validation failed'));
    }
    next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.params['id'];

    const user = await UserModel.findById(userId!);
    if (!user) {
      return next(new NotFoundError('User'));
    }

    const userResponse = UserModel.toResponse(user);
    res.json(userResponse);
  } catch (error) {
    next(error);
  }
}
