import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  officerId: string; // e.g., "OFF_4021"
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    officerId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    name: { 
      type: String, 
      required: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true 
    },
    password: { 
      type: String, 
      required: true 
    },
    phone: { 
      type: String 
    },
    avatarUrl: { 
      type: String, 
      default: '' 
    },
  },
  { 
    timestamps: true 
  }
);

export const User = model<IUser>('User', UserSchema);