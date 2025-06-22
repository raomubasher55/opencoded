import { UserModel } from '../models/user.model';
import { Document } from 'mongoose';
import { NotFoundError, BadRequestError } from '@opencode/shared-utils';

export class UserService {
  /**
   * Get all users
   */
  async getUsers(): Promise<Document[]> {
    return UserModel.find().select('-passwordHash -apiKeys');
  }

  /**
   * Get a user by ID
   */
  async getUserById(userId: string): Promise<Document> {
    const user = await UserModel.findById(userId).select('-passwordHash -apiKeys');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    return user;
  }

  /**
   * Update a user's information
   */
  async updateUser(userId: string, userData: { username?: string; email?: string }): Promise<Document> {
    const { username, email } = userData;
    
    // Check if the update data is valid
    if (!username && !email) {
      throw new BadRequestError('At least one field must be provided for update');
    }
    
    // Check if username or email already exists
    if (username || email) {
      const query: any = { _id: { $ne: userId } };
      
      if (username) query.username = username;
      if (email) query.email = email;
      
      const existingUser = await UserModel.findOne(query);
      if (existingUser) {
        throw new BadRequestError('Username or email already in use');
      }
    }
    
    // Update user
    const updateData: any = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('-passwordHash -apiKeys');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    return user;
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string) {
    const user = await UserModel.findByIdAndDelete(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    return true;
  }
}