import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

// Create a singleton instance of the UserService
const userService = new UserService();

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await userService.getUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId;
    const user = await userService.getUserById(userId);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId;
    const { username, email } = req.body;
    const user = await userService.updateUser(userId, { username, email });
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId;
    await userService.deleteUser(userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};