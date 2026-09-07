import { Request, Response, NextFunction } from "express";
import * as UserService from "../services/UserService";
import { IUser } from "../models/User";
import jwt from "jsonwebtoken";
import { config } from "../config/db";
import { uploadImage } from "../services/cloudinaryService";

export const getTest = (req: Request, res: Response, next: NextFunction) => {
  return res.status(200).json({
    success: true,
    message: "Hello from the Controller Layer!",
  });
};

export const postUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const avatarUrl = req.file
      ? await uploadImage(req.file.buffer)
      : req.body.avatarUrl;
    const userData: IUser = { ...req.body, avatarUrl };

    const newUser = await UserService.createUser(userData);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: newUser,
    });
  } catch (error: any) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await UserService.authenticateUser(email, password);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), officerId: user.officerId },
      config.jwtSecret,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        officerId: user.officerId,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.userId !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own profile",
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "email")) {
      return res.status(400).json({
        success: false,
        message: "Email cannot be updated",
      });
    }

    const allowedFields = ["name", "phone", "avatarUrl"] as const;
    const profileData = Object.fromEntries(
      allowedFields
        .filter((field) => req.body[field] !== undefined)
        .map((field) => [field, req.body[field]])
    );

    if (req.file) {
      profileData.avatarUrl = await uploadImage(req.file.buffer);
    }

    if (Object.keys(profileData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one profile field to update",
      });
    }

    const user = await UserService.updateUserProfile(req.params.id, profileData);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
};

export const getuser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await UserService.getuser(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    next(error);
  }
};
