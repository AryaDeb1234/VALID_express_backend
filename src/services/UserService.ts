import { User, IUser } from '../models/User';
import bcrypt from 'bcrypt';

export const getTestData = async () => {
  return { message: "Hello from the Service Layer!" };
};

// New logic to save a user
export const createUser = async (userData: IUser) => {
  const password = await bcrypt.hash(userData.password, 12);
  const newUser = await User.create({ ...userData, password });
  return newUser;
};

export const authenticateUser = async (email: string, password: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || typeof user.password !== 'string' || user.password.length === 0) {
    return null;
  }

  if (!(await bcrypt.compare(password, user.password))) {
    return null;
  }

  return user;
};

export interface UpdateUserProfile {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

export const updateUserProfile = async (
  userId: string,
  profileData: UpdateUserProfile
) => {
  return User.findByIdAndUpdate(
    userId,
    { $set: profileData },
    { new: true, runValidators: true }
  ).select('-password');
};

export const getuser=async(userId:string)=>{
  const user = await User.findById(userId).select('-password'); // Exclude the password field from the result
  
  if(!user){
    return null;
  }
  return user;
}