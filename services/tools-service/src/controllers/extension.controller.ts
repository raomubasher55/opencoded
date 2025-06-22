import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@opencode/shared-utils';
import { ExtensionService } from '../services/extension.service';
import { ExtensionType, ExtensionStatus } from '../models/extension.model';
import { ApiError } from '../middleware/error.middleware';
import * as path from 'path';

const logger = createServiceLogger('extension-controller');
const extensionService = new ExtensionService();

export const ExtensionController = {
  /**
   * Get all extensions
   */
  async getExtensions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        type, 
        status, 
        keyword, 
        author,
        sort = '-createdAt',
        page = 1, 
        limit = 20 
      } = req.query;
      
      const result = await extensionService.getExtensions(
        {
          type: type as ExtensionType,
          status: status as ExtensionStatus,
          keyword: keyword as string,
          author: author as string
        },
        sort as string,
        Number(page),
        Number(limit)
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get extension by ID
   */
  async getExtensionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const extension = await extensionService.getExtensionById(id);
      
      res.status(200).json({
        success: true,
        data: extension
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get extension by name
   */
  async getExtensionByName(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params;
      const extension = await extensionService.getExtensionByName(name);
      
      res.status(200).json({
        success: true,
        data: extension
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new extension
   */
  async createExtension(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if package file is provided
      if (!req.file) {
        throw new ApiError('Package file is required', 400);
      }
      
      // Get extension data from request body
      const extensionData = req.body;
      
      // Add author information
      extensionData.author = {
        id: req.user!.id,
        username: req.user!.username,
        email: req.user!.email
      };
      
      // Create extension
      const extension = await extensionService.createExtension(
        extensionData,
        req.file.buffer
      );
      
      res.status(201).json({
        success: true,
        message: 'Extension created successfully',
        data: extension
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update an existing extension
   */
  async updateExtension(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const extensionData = req.body;
      
      // Get existing extension
      const existingExtension = await extensionService.getExtensionById(id);
      
      // Check if user is authorized
      if (existingExtension.author.id !== req.user!.id && req.user!.role !== 'admin') {
        throw new ApiError('Unauthorized', 403);
      }
      
      // Update extension
      const extension = await extensionService.updateExtension(id, extensionData);
      
      res.status(200).json({
        success: true,
        message: 'Extension updated successfully',
        data: extension
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update extension status
   */
  async updateExtensionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      
      // Check if user is admin
      if (req.user!.role !== 'admin') {
        throw new ApiError('Unauthorized', 403);
      }
      
      // Validate status
      if (!Object.values(ExtensionStatus).includes(status)) {
        throw new ApiError('Invalid status', 400);
      }
      
      // Update status
      const extension = await extensionService.updateExtensionStatus(id, status, reason);
      
      res.status(200).json({
        success: true,
        message: `Extension status updated to ${status}`,
        data: extension
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete an extension
   */
  async deleteExtension(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get existing extension
      const existingExtension = await extensionService.getExtensionById(id);
      
      // Check if user is authorized
      if (existingExtension.author.id !== req.user!.id && req.user!.role !== 'admin') {
        throw new ApiError('Unauthorized', 403);
      }
      
      // Delete extension
      await extensionService.deleteExtension(id);
      
      res.status(200).json({
        success: true,
        message: 'Extension deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get extension versions
   */
  async getExtensionVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const versions = await extensionService.getExtensionVersions(id);
      
      res.status(200).json({
        success: true,
        data: versions
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get specific extension version
   */
  async getExtensionVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, version } = req.params;
      const versionDoc = await extensionService.getExtensionVersion(id, version);
      
      res.status(200).json({
        success: true,
        data: versionDoc
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new extension version
   */
  async createExtensionVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      // Check if package file is provided
      if (!req.file) {
        throw new ApiError('Package file is required', 400);
      }
      
      // Get existing extension
      const existingExtension = await extensionService.getExtensionById(id);
      
      // Check if user is authorized
      if (existingExtension.author.id !== req.user!.id && req.user!.role !== 'admin') {
        throw new ApiError('Unauthorized', 403);
      }
      
      // Create version
      const version = await extensionService.createExtensionVersion(
        id,
        req.body,
        req.file.buffer
      );
      
      res.status(201).json({
        success: true,
        message: 'Extension version created successfully',
        data: version
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Download extension package
   */
  async downloadExtensionPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, version } = req.params;
      
      // Get package file
      const { buffer, fileName, mimeType } = await extensionService.getPackageFile(id, version);
      
      // Set response headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      
      // Send file
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Rate an extension
   */
  async rateExtension(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { rating, review } = req.body;
      
      // Validate rating
      if (!rating || rating < 1 || rating > 5) {
        throw new ApiError('Rating must be between 1 and 5', 400);
      }
      
      // Rate extension
      const ratingDoc = await extensionService.rateExtension(
        id,
        req.user!.id,
        rating,
        review
      );
      
      res.status(200).json({
        success: true,
        message: 'Extension rated successfully',
        data: ratingDoc
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get extension ratings
   */
  async getExtensionRatings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;
      
      const ratings = await extensionService.getExtensionRatings(
        id,
        Number(page),
        Number(limit)
      );
      
      res.status(200).json({
        success: true,
        data: ratings
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Install an extension
   */
  async installExtension(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { version } = req.body;
      
      // Install extension
      const installation = await extensionService.installExtension(
        id,
        req.user!.id,
        version
      );
      
      res.status(200).json({
        success: true,
        message: 'Extension installed successfully',
        data: installation
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Uninstall an extension
   */
  async uninstallExtension(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      // Uninstall extension
      const installation = await extensionService.uninstallExtension(
        id,
        req.user!.id
      );
      
      res.status(200).json({
        success: true,
        message: 'Extension uninstalled successfully',
        data: installation
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get installed extensions for current user
   */
  async getUserExtensions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const extensions = await extensionService.getUserExtensions(req.user!.id);
      
      res.status(200).json({
        success: true,
        data: extensions
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update extension settings
   */
  async updateExtensionSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { settings } = req.body;
      
      // Update settings
      const installation = await extensionService.updateExtensionSettings(
        id,
        req.user!.id,
        settings
      );
      
      res.status(200).json({
        success: true,
        message: 'Extension settings updated successfully',
        data: installation
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Search extensions
   */
  async searchExtensions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        q, 
        type, 
        status, 
        sort = '-rating.average',
        page = 1, 
        limit = 20 
      } = req.query;
      
      if (!q) {
        throw new ApiError('Search query is required', 400);
      }
      
      const result = await extensionService.searchExtensions(
        q as string,
        {
          type: type as ExtensionType,
          status: status as ExtensionStatus
        },
        sort as string,
        Number(page),
        Number(limit)
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};