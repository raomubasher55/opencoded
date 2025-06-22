import { createServiceLogger } from '@opencode/shared-utils';
import { ExtensionModel, IExtension, ExtensionStatus, ExtensionType } from '../models/extension.model';
import { ExtensionVersionModel, IExtensionVersion } from '../models/extension-version.model';
import { ExtensionRatingModel, IExtensionRating } from '../models/extension-rating.model';
import { ExtensionInstallModel, IExtensionInstall } from '../models/extension-install.model';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as semver from 'semver';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const logger = createServiceLogger('extension-service');

// Helper functions
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

export class ExtensionService {
  private storageDir: string;

  constructor() {
    // Set storage directory for extension packages
    this.storageDir = process.env.EXTENSION_STORAGE_DIR || path.join(process.cwd(), 'storage', 'extensions');
    
    // Ensure storage directory exists
    this.ensureStorageDirectory();
    
    logger.info('Extension service initialized');
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.storageDir)) {
        await mkdir(this.storageDir, { recursive: true });
        logger.info(`Created storage directory: ${this.storageDir}`);
      }
    } catch (error) {
      logger.error('Failed to create storage directory', error);
      throw error;
    }
  }

  /**
   * Calculate SHA-256 hash of a file
   */
  private async calculateSha256(filePath: string): Promise<string> {
    const fileBuffer = await readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }

  /**
   * Get all extensions with optional filtering
   */
  async getExtensions(
    filter: {
      type?: ExtensionType;
      status?: ExtensionStatus;
      keyword?: string;
      author?: string;
    } = {},
    sort: string = '-createdAt',
    page: number = 1,
    limit: number = 20
  ): Promise<{ extensions: IExtension[]; total: number; page: number; pages: number }> {
    try {
      const query: any = {};
      
      // Apply filters
      if (filter.type) {
        query.type = filter.type;
      }
      
      if (filter.status) {
        query.status = filter.status;
      } else {
        // By default, only return approved extensions
        query.status = ExtensionStatus.APPROVED;
      }
      
      if (filter.keyword) {
        query.keywords = filter.keyword;
      }
      
      if (filter.author) {
        query['author.id'] = filter.author;
      }
      
      // Count total
      const total = await ExtensionModel.countDocuments(query);
      
      // Get paginated results
      const extensions = await ExtensionModel.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      return {
        extensions,
        total,
        page,
        pages
      };
    } catch (error) {
      logger.error('Failed to get extensions', error);
      throw error;
    }
  }

  /**
   * Get extension by ID
   */
  async getExtensionById(id: string): Promise<IExtension> {
    try {
      const extension = await ExtensionModel.findById(id);
      
      if (!extension) {
        throw new Error(`Extension not found: ${id}`);
      }
      
      return extension;
    } catch (error) {
      logger.error(`Failed to get extension: ${id}`, error);
      throw error;
    }
  }

  /**
   * Get extension by name
   */
  async getExtensionByName(name: string): Promise<IExtension> {
    try {
      const extension = await ExtensionModel.findOne({ name });
      
      if (!extension) {
        throw new Error(`Extension not found: ${name}`);
      }
      
      return extension;
    } catch (error) {
      logger.error(`Failed to get extension: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a new extension
   */
  async createExtension(extensionData: Partial<IExtension>, packageBuffer: Buffer): Promise<IExtension> {
    try {
      // Validate required fields
      if (!extensionData.name || !extensionData.displayName || !extensionData.description ||
          !extensionData.version || !extensionData.type || !extensionData.author ||
          !extensionData.entryPoint || !extensionData.schema) {
        throw new Error('Missing required fields for extension');
      }
      
      // Validate version format
      if (!semver.valid(extensionData.version)) {
        throw new Error('Invalid version format. Use semver format (e.g. 1.0.0)');
      }
      
      // Check if extension name already exists
      const existingExtension = await ExtensionModel.findOne({ name: extensionData.name });
      
      if (existingExtension) {
        throw new Error(`Extension name already exists: ${extensionData.name}`);
      }
      
      // Save the package file
      const fileName = `${extensionData.name}-${extensionData.version}.zip`;
      const filePath = path.join(this.storageDir, fileName);
      
      await writeFile(filePath, packageBuffer);
      
      // Calculate SHA-256 hash
      const sha256 = await this.calculateSha256(filePath);
      
      // Create extension document
      const extension = new ExtensionModel({
        ...extensionData,
        status: ExtensionStatus.PENDING_REVIEW,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await extension.save();
      
      // Create initial version document
      const version = new ExtensionVersionModel({
        extensionId: extension._id,
        version: extensionData.version,
        description: extensionData.description,
        changelog: extensionData.changelog || `Initial version ${extensionData.version}`,
        dependencies: extensionData.dependencies || [],
        entryPoint: extensionData.entryPoint,
        schema: extensionData.schema,
        status: ExtensionStatus.PENDING_REVIEW,
        packageUrl: `/api/extensions/${extension._id}/versions/${extensionData.version}/download`,
        sha256,
        size: packageBuffer.length,
        createdAt: new Date()
      });
      
      await version.save();
      
      logger.info(`Created extension: ${extension.name} (${extension._id})`);
      
      return extension;
    } catch (error) {
      logger.error('Failed to create extension', error);
      throw error;
    }
  }

  /**
   * Update an existing extension
   */
  async updateExtension(id: string, extensionData: Partial<IExtension>): Promise<IExtension> {
    try {
      // Get existing extension
      const extension = await this.getExtensionById(id);
      
      // Update fields
      Object.assign(extension, extensionData, { updatedAt: new Date() });
      
      await extension.save();
      
      logger.info(`Updated extension: ${extension.name} (${extension._id})`);
      
      return extension;
    } catch (error) {
      logger.error(`Failed to update extension: ${id}`, error);
      throw error;
    }
  }

  /**
   * Update extension status
   */
  async updateExtensionStatus(
    id: string,
    status: ExtensionStatus,
    reason?: string
  ): Promise<IExtension> {
    try {
      // Get existing extension
      const extension = await this.getExtensionById(id);
      
      // Update status
      extension.status = status;
      extension.updatedAt = new Date();
      
      // Set status-specific timestamps
      if (status === ExtensionStatus.APPROVED) {
        extension.approvedAt = new Date();
        extension.rejectedAt = undefined;
        extension.rejectionReason = undefined;
      } else if (status === ExtensionStatus.REJECTED) {
        extension.rejectedAt = new Date();
        extension.rejectionReason = reason;
        extension.approvedAt = undefined;
      }
      
      await extension.save();
      
      // Update latest version status as well
      const latestVersion = await ExtensionVersionModel.findOne(
        { extensionId: extension._id },
        {},
        { sort: { 'version': -1 } }
      );
      
      if (latestVersion) {
        latestVersion.status = status;
        
        if (status === ExtensionStatus.APPROVED) {
          latestVersion.approvedAt = new Date();
          latestVersion.rejectedAt = undefined;
          latestVersion.rejectionReason = undefined;
        } else if (status === ExtensionStatus.REJECTED) {
          latestVersion.rejectedAt = new Date();
          latestVersion.rejectionReason = reason;
          latestVersion.approvedAt = undefined;
        }
        
        await latestVersion.save();
      }
      
      logger.info(`Updated extension status: ${extension.name} (${extension._id}) to ${status}`);
      
      return extension;
    } catch (error) {
      logger.error(`Failed to update extension status: ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete an extension
   */
  async deleteExtension(id: string): Promise<boolean> {
    try {
      // Get existing extension
      const extension = await this.getExtensionById(id);
      
      // Delete all versions
      const versions = await ExtensionVersionModel.find({ extensionId: extension._id });
      
      for (const version of versions) {
        // Delete package file
        const fileName = `${extension.name}-${version.version}.zip`;
        const filePath = path.join(this.storageDir, fileName);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // Delete version document
        await version.deleteOne();
      }
      
      // Delete ratings
      await ExtensionRatingModel.deleteMany({ extensionId: extension._id });
      
      // Delete installs
      await ExtensionInstallModel.deleteMany({ extensionId: extension._id });
      
      // Delete extension document
      await extension.deleteOne();
      
      logger.info(`Deleted extension: ${extension.name} (${extension._id})`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete extension: ${id}`, error);
      throw error;
    }
  }

  /**
   * Get extension versions
   */
  async getExtensionVersions(extensionId: string): Promise<IExtensionVersion[]> {
    try {
      // Get existing extension
      await this.getExtensionById(extensionId);
      
      // Get versions
      const versions = await ExtensionVersionModel.find({ extensionId })
        .sort({ version: -1 });
      
      return versions;
    } catch (error) {
      logger.error(`Failed to get extension versions: ${extensionId}`, error);
      throw error;
    }
  }

  /**
   * Get specific extension version
   */
  async getExtensionVersion(extensionId: string, version: string): Promise<IExtensionVersion> {
    try {
      // Get existing extension
      await this.getExtensionById(extensionId);
      
      // Get version
      const versionDoc = await ExtensionVersionModel.findOne({
        extensionId,
        version
      });
      
      if (!versionDoc) {
        throw new Error(`Version not found: ${version}`);
      }
      
      return versionDoc;
    } catch (error) {
      logger.error(`Failed to get extension version: ${extensionId}/${version}`, error);
      throw error;
    }
  }

  /**
   * Create a new extension version
   */
  async createExtensionVersion(
    extensionId: string,
    versionData: Partial<IExtensionVersion>,
    packageBuffer: Buffer
  ): Promise<IExtensionVersion> {
    try {
      // Get existing extension
      const extension = await this.getExtensionById(extensionId);
      
      // Validate required fields
      if (!versionData.version || !versionData.description || !versionData.changelog) {
        throw new Error('Missing required fields for version');
      }
      
      // Validate version format
      if (!semver.valid(versionData.version)) {
        throw new Error('Invalid version format. Use semver format (e.g. 1.0.0)');
      }
      
      // Check if version already exists
      const existingVersion = await ExtensionVersionModel.findOne({
        extensionId,
        version: versionData.version
      });
      
      if (existingVersion) {
        throw new Error(`Version already exists: ${versionData.version}`);
      }
      
      // Check if version is greater than existing versions
      const latestVersion = await ExtensionVersionModel.findOne(
        { extensionId },
        {},
        { sort: { 'version': -1 } }
      );
      
      if (latestVersion && !semver.gt(versionData.version, latestVersion.version)) {
        throw new Error(`New version must be greater than ${latestVersion.version}`);
      }
      
      // Save the package file
      const fileName = `${extension.name}-${versionData.version}.zip`;
      const filePath = path.join(this.storageDir, fileName);
      
      await writeFile(filePath, packageBuffer);
      
      // Calculate SHA-256 hash
      const sha256 = await this.calculateSha256(filePath);
      
      // Create version document
      const version = new ExtensionVersionModel({
        extensionId,
        version: versionData.version,
        description: versionData.description,
        changelog: versionData.changelog,
        dependencies: versionData.dependencies || extension.dependencies,
        entryPoint: versionData.entryPoint || extension.entryPoint,
        schema: versionData.schema || extension.schema,
        status: ExtensionStatus.PENDING_REVIEW,
        packageUrl: `/api/extensions/${extensionId}/versions/${versionData.version}/download`,
        sha256,
        size: packageBuffer.length,
        createdAt: new Date()
      });
      
      await version.save();
      
      // Update extension with new version info
      extension.version = versionData.version;
      extension.description = versionData.description;
      extension.dependencies = versionData.dependencies || extension.dependencies;
      extension.entryPoint = versionData.entryPoint || extension.entryPoint;
      extension.schema = versionData.schema || extension.schema;
      extension.status = ExtensionStatus.PENDING_REVIEW;
      extension.updatedAt = new Date();
      
      await extension.save();
      
      logger.info(`Created extension version: ${extension.name}@${version.version}`);
      
      return version;
    } catch (error) {
      logger.error(`Failed to create extension version: ${extensionId}`, error);
      throw error;
    }
  }

  /**
   * Get package file for a specific version
   */
  async getPackageFile(extensionId: string, version: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    try {
      // Get existing extension and version
      const extension = await this.getExtensionById(extensionId);
      await this.getExtensionVersion(extensionId, version);
      
      // Get package file
      const fileName = `${extension.name}-${version}.zip`;
      const filePath = path.join(this.storageDir, fileName);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Package file not found: ${fileName}`);
      }
      
      const buffer = await readFile(filePath);
      
      // Increment download count
      extension.downloads += 1;
      await extension.save();
      
      return {
        buffer,
        fileName,
        mimeType: 'application/zip'
      };
    } catch (error) {
      logger.error(`Failed to get package file: ${extensionId}/${version}`, error);
      throw error;
    }
  }

  /**
   * Add a rating for an extension
   */
  async rateExtension(
    extensionId: string,
    userId: string,
    rating: number,
    review?: string
  ): Promise<IExtensionRating> {
    try {
      // Validate rating
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      
      // Get existing extension
      const extension = await this.getExtensionById(extensionId);
      
      // Check if user already rated this extension
      const existingRating = await ExtensionRatingModel.findOne({
        extensionId,
        userId
      });
      
      if (existingRating) {
        // Update existing rating
        existingRating.rating = rating;
        existingRating.review = review;
        existingRating.updatedAt = new Date();
        
        await existingRating.save();
        
        // Update extension rating average
        await this.updateExtensionRatingAverage(extensionId);
        
        return existingRating;
      } else {
        // Create new rating
        const newRating = new ExtensionRatingModel({
          extensionId,
          userId,
          rating,
          review,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await newRating.save();
        
        // Update extension rating average
        await this.updateExtensionRatingAverage(extensionId);
        
        return newRating;
      }
    } catch (error) {
      logger.error(`Failed to rate extension: ${extensionId}`, error);
      throw error;
    }
  }

  /**
   * Update extension rating average
   */
  private async updateExtensionRatingAverage(extensionId: string): Promise<void> {
    try {
      // Get all ratings for this extension
      const ratings = await ExtensionRatingModel.find({ extensionId });
      
      if (ratings.length === 0) {
        return;
      }
      
      // Calculate average rating
      const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
      const averageRating = totalRating / ratings.length;
      
      // Update extension rating
      await ExtensionModel.updateOne(
        { _id: extensionId },
        {
          $set: {
            'rating.average': averageRating,
            'rating.count': ratings.length
          }
        }
      );
    } catch (error) {
      logger.error(`Failed to update extension rating average: ${extensionId}`, error);
      throw error;
    }
  }

  /**
   * Get ratings for an extension
   */
  async getExtensionRatings(
    extensionId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ ratings: IExtensionRating[]; total: number; page: number; pages: number }> {
    try {
      // Get existing extension
      await this.getExtensionById(extensionId);
      
      // Count total ratings
      const total = await ExtensionRatingModel.countDocuments({ extensionId });
      
      // Get paginated ratings
      const ratings = await ExtensionRatingModel.find({ extensionId })
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit);
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      return {
        ratings,
        total,
        page,
        pages
      };
    } catch (error) {
      logger.error(`Failed to get extension ratings: ${extensionId}`, error);
      throw error;
    }
  }

  /**
   * Install an extension for a user
   */
  async installExtension(
    extensionId: string,
    userId: string,
    version?: string
  ): Promise<IExtensionInstall> {
    try {
      // Get existing extension
      const extension = await this.getExtensionById(extensionId);
      
      // Use latest version if not specified
      if (!version) {
        version = extension.version;
      }
      
      // Check if version exists
      await this.getExtensionVersion(extensionId, version);
      
      // Check if already installed
      const existingInstall = await ExtensionInstallModel.findOne({
        extensionId,
        userId
      });
      
      if (existingInstall) {
        // Update existing installation
        existingInstall.version = version;
        existingInstall.status = 'active';
        existingInstall.uninstalledAt = undefined;
        
        await existingInstall.save();
        
        logger.info(`Updated extension installation: ${extension.name}@${version} for user ${userId}`);
        
        return existingInstall;
      } else {
        // Create new installation
        const newInstall = new ExtensionInstallModel({
          extensionId,
          userId,
          version,
          installedAt: new Date(),
          status: 'active'
        });
        
        await newInstall.save();
        
        logger.info(`Installed extension: ${extension.name}@${version} for user ${userId}`);
        
        return newInstall;
      }
    } catch (error) {
      logger.error(`Failed to install extension: ${extensionId}`, error);
      throw error;
    }
  }

  /**
   * Uninstall an extension for a user
   */
  async uninstallExtension(extensionId: string, userId: string): Promise<IExtensionInstall> {
    try {
      // Get existing extension
      await this.getExtensionById(extensionId);
      
      // Get installation
      const installation = await ExtensionInstallModel.findOne({
        extensionId,
        userId
      });
      
      if (!installation) {
        throw new Error('Extension not installed');
      }
      
      // Update installation status
      installation.status = 'uninstalled';
      installation.uninstalledAt = new Date();
      
      await installation.save();
      
      logger.info(`Uninstalled extension: ${extensionId} for user ${userId}`);
      
      return installation;
    } catch (error) {
      logger.error(`Failed to uninstall extension: ${extensionId}`, error);
      throw error;
    }
  }

  /**
   * Get installed extensions for a user
   */
  async getUserExtensions(userId: string): Promise<{ extension: IExtension; installation: IExtensionInstall }[]> {
    try {
      // Get installations
      const installations = await ExtensionInstallModel.find({
        userId,
        status: 'active'
      });
      
      // Get extension details
      const result = await Promise.all(
        installations.map(async (installation) => {
          const extension = await this.getExtensionById(installation.extensionId);
          return { extension, installation };
        })
      );
      
      return result;
    } catch (error) {
      logger.error(`Failed to get user extensions: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Update extension settings for a user
   */
  async updateExtensionSettings(
    extensionId: string,
    userId: string,
    settings: any
  ): Promise<IExtensionInstall> {
    try {
      // Get installation
      const installation = await ExtensionInstallModel.findOne({
        extensionId,
        userId,
        status: 'active'
      });
      
      if (!installation) {
        throw new Error('Extension not installed or not active');
      }
      
      // Update settings
      installation.settings = settings;
      
      await installation.save();
      
      logger.info(`Updated extension settings: ${extensionId} for user ${userId}`);
      
      return installation;
    } catch (error) {
      logger.error(`Failed to update extension settings: ${extensionId}`, error);
      throw error;
    }
  }

  /**
   * Search extensions
   */
  async searchExtensions(
    query: string,
    filter: {
      type?: ExtensionType;
      status?: ExtensionStatus;
    } = {},
    sort: string = '-rating.average',
    page: number = 1,
    limit: number = 20
  ): Promise<{ extensions: IExtension[]; total: number; page: number; pages: number }> {
    try {
      // Build search query
      const searchQuery: any = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { displayName: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { keywords: { $regex: query, $options: 'i' } }
        ]
      };
      
      // Apply filters
      if (filter.type) {
        searchQuery.type = filter.type;
      }
      
      if (filter.status) {
        searchQuery.status = filter.status;
      } else {
        // By default, only return approved extensions
        searchQuery.status = ExtensionStatus.APPROVED;
      }
      
      // Count total results
      const total = await ExtensionModel.countDocuments(searchQuery);
      
      // Get paginated results
      const extensions = await ExtensionModel.find(searchQuery)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      return {
        extensions,
        total,
        page,
        pages
      };
    } catch (error) {
      logger.error(`Failed to search extensions: ${query}`, error);
      throw error;
    }
  }
}