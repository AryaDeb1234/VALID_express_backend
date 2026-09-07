import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config/db';

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : undefined;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;

    if (typeof decoded.userId !== 'string') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      });
    }

    req.userId = decoded.userId;
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
    });
  }
};