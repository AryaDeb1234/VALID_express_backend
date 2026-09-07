import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Catch Mongoose Invalid ID (CastError)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: "Resource not found. Invalid ID format."
    });
  }

  // Catch the "Unexpected end of JSON" error
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ 
      success: false, 
      message: "Invalid JSON format in request body" 
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};