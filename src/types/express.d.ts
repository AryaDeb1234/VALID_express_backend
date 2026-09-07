import * as express from 'express';

import { IUser } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      customField?: string;
      userProfile?: IUser;
      userId?: string;
    }
  }
}