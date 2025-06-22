import { createServiceLogger } from '@opencode/shared-utils';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import caching from './caching';
import { CacheLevel, CacheStrategy } from './caching';

const logger = createServiceLogger('file-chunking');

/**
 * File chunk information
 */
export interface FileChunk {
  chunkId: string;
  fileId: string;
  index: number;
  totalChunks: number;
  data: Buffer;
  size: number;
  checksum: string;
}

/**
 * File upload status
 */
export interface FileUploadStatus {
  fileId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedChunks: number[];
  totalChunks: number;
  isComplete: boolean;
  checksum?: string;
  path?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * File chunking service for handling large file transfers
 */
export class FileChunkingService {
  private chunkSize: number;
  private uploadDir: string;
  private maxFileSize: number;
  private fileUploads: Map<string, FileUploadStatus> = new Map();
  private fileChunks: Map<string, Map<number, FileChunk>> = new Map();
  
  /**
   * Create a new file chunking service
   */
  constructor() {
    // Configure service
    this.chunkSize = parseInt(process.env.FILE_CHUNK_SIZE || '1048576', 10); // 1MB default
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '104857600', 10); // 100MB default
    
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    
    logger.info('File chunking service initialized', {
      chunkSize: this.formatBytes(this.chunkSize),
      maxFileSize: this.formatBytes(this.maxFileSize),
      uploadDir: this.uploadDir
    });
  }
  
  /**
   * Format bytes into human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Initialize a new file upload
   */
  initializeUpload(filename: string, size: number, mimeType: string): FileUploadStatus {
    // Validate file size
    if (size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.formatBytes(this.maxFileSize)}`);
    }
    
    // Generate file ID
    const fileId = crypto.randomUUID();
    
    // Calculate total chunks
    const totalChunks = Math.ceil(size / this.chunkSize);
    
    // Create upload status
    const uploadStatus: FileUploadStatus = {
      fileId,
      filename,
      size,
      mimeType,
      uploadedChunks: [],
      totalChunks,
      isComplete: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Store upload status
    this.fileUploads.set(fileId, uploadStatus);
    
    // Initialize chunk map
    this.fileChunks.set(fileId, new Map());
    
    logger.info('Initialized file upload', {
      fileId,
      filename,
      size: this.formatBytes(size),
      totalChunks
    });
    
    return uploadStatus;
  }
  
  /**
   * Process a file chunk
   */
  processChunk(chunk: FileChunk): FileUploadStatus {
    const { fileId, index, totalChunks, data, checksum } = chunk;
    
    // Validate file ID
    const uploadStatus = this.fileUploads.get(fileId);
    if (!uploadStatus) {
      throw new Error(`Upload not found for file ID: ${fileId}`);
    }
    
    // Validate chunk index
    if (index < 0 || index >= totalChunks) {
      throw new Error(`Invalid chunk index: ${index}`);
    }
    
    // Validate checksum
    const calculatedChecksum = this.calculateChecksum(data);
    if (calculatedChecksum !== checksum) {
      throw new Error('Chunk checksum mismatch');
    }
    
    // Store chunk
    const chunks = this.fileChunks.get(fileId)!;
    chunks.set(index, chunk);
    
    // Update upload status
    uploadStatus.uploadedChunks.push(index);
    uploadStatus.updatedAt = new Date();
    
    // Check if upload is complete
    if (uploadStatus.uploadedChunks.length === totalChunks) {
      this.finalizeUpload(fileId);
    }
    
    logger.debug('Processed chunk', {
      fileId,
      index,
      progress: `${uploadStatus.uploadedChunks.length}/${totalChunks}`
    });
    
    return { ...uploadStatus };
  }
  
  /**
   * Finalize a file upload
   */
  private async finalizeUpload(fileId: string): Promise<void> {
    const uploadStatus = this.fileUploads.get(fileId);
    if (!uploadStatus) {
      throw new Error(`Upload not found for file ID: ${fileId}`);
    }
    
    try {
      // Get chunks
      const chunks = this.fileChunks.get(fileId)!;
      
      // Sort chunks by index
      const sortedChunks = Array.from({ length: uploadStatus.totalChunks })
        .map((_, i) => chunks.get(i))
        .filter(Boolean);
      
      // Create file path
      const sanitizedFilename = uploadStatus.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = path.join(this.uploadDir, `${fileId}-${sanitizedFilename}`);
      
      // Create write stream
      const writeStream = fs.createWriteStream(filePath);
      
      // Write chunks to file
      for (const chunk of sortedChunks) {
        writeStream.write(chunk!.data);
      }
      
      // Close stream
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        writeStream.end();
      });
      
      // Calculate file checksum
      const fileChecksum = await this.calculateFileChecksum(filePath);
      
      // Update upload status
      uploadStatus.isComplete = true;
      uploadStatus.checksum = fileChecksum;
      uploadStatus.path = filePath;
      uploadStatus.updatedAt = new Date();
      
      // Cache file information
      caching.set(
        `file_info:${fileId}`,
        {
          fileId,
          filename: uploadStatus.filename,
          size: uploadStatus.size,
          mimeType: uploadStatus.mimeType,
          checksum: fileChecksum,
          path: filePath
        },
        3600, // 1 hour
        CacheLevel.PERSISTENT,
        CacheStrategy.USER_SCOPED
      );
      
      logger.info('Finalized file upload', {
        fileId,
        filename: uploadStatus.filename,
        size: this.formatBytes(uploadStatus.size),
        path: filePath
      });
      
      // Clean up chunks to free memory
      setTimeout(() => {
        this.fileChunks.delete(fileId);
      }, 5000);
    } catch (error) {
      logger.error('Error finalizing upload', error);
      throw error;
    }
  }
  
  /**
   * Calculate checksum for a buffer
   */
  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Calculate checksum for a file
   */
  private async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
  
  /**
   * Get upload status
   */
  getUploadStatus(fileId: string): FileUploadStatus | undefined {
    return this.fileUploads.get(fileId);
  }
  
  /**
   * Get file information
   */
  async getFileInfo(fileId: string): Promise<any> {
    // Try to get from cache first
    const cachedInfo = caching.get(`file_info:${fileId}`, CacheLevel.PERSISTENT);
    if (cachedInfo) {
      return cachedInfo;
    }
    
    // Get from upload status
    const uploadStatus = this.fileUploads.get(fileId);
    if (!uploadStatus || !uploadStatus.isComplete) {
      throw new Error(`File not found or upload not complete: ${fileId}`);
    }
    
    // Check if file exists
    if (!uploadStatus.path || !fs.existsSync(uploadStatus.path)) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    return {
      fileId,
      filename: uploadStatus.filename,
      size: uploadStatus.size,
      mimeType: uploadStatus.mimeType,
      checksum: uploadStatus.checksum,
      path: uploadStatus.path
    };
  }
  
  /**
   * Read a file as stream
   */
  createReadStream(fileId: string): fs.ReadStream {
    const uploadStatus = this.fileUploads.get(fileId);
    if (!uploadStatus || !uploadStatus.isComplete || !uploadStatus.path) {
      throw new Error(`File not found or upload not complete: ${fileId}`);
    }
    
    // Check if file exists
    if (!fs.existsSync(uploadStatus.path)) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    return fs.createReadStream(uploadStatus.path);
  }
  
  /**
   * Read a file chunk by chunk
   */
  async* readFileChunks(fileId: string, chunkSize?: number): AsyncGenerator<Buffer> {
    const uploadStatus = this.fileUploads.get(fileId);
    if (!uploadStatus || !uploadStatus.isComplete || !uploadStatus.path) {
      throw new Error(`File not found or upload not complete: ${fileId}`);
    }
    
    // Check if file exists
    if (!fs.existsSync(uploadStatus.path)) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    // Use specified chunk size or default
    const size = chunkSize || this.chunkSize;
    
    // Create read stream
    const stream = fs.createReadStream(uploadStatus.path, {
      highWaterMark: size
    });
    
    // Yield chunks
    for await (const chunk of stream) {
      yield chunk;
    }
  }
  
  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const uploadStatus = this.fileUploads.get(fileId);
    if (!uploadStatus) {
      return false;
    }
    
    // Delete file if it exists
    if (uploadStatus.path && fs.existsSync(uploadStatus.path)) {
      fs.unlinkSync(uploadStatus.path);
    }
    
    // Clean up
    this.fileUploads.delete(fileId);
    this.fileChunks.delete(fileId);
    
    // Remove from cache
    caching.del(`file_info:${fileId}`);
    
    logger.info('Deleted file', {
      fileId,
      filename: uploadStatus.filename
    });
    
    return true;
  }
  
  /**
   * Clean up expired uploads
   */
  cleanupExpiredUploads(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = new Date().getTime();
    
    for (const [fileId, status] of this.fileUploads.entries()) {
      // Skip completed uploads
      if (status.isComplete) continue;
      
      // Check if upload is expired
      const age = now - status.updatedAt.getTime();
      if (age > maxAge) {
        logger.info('Cleaning up expired upload', {
          fileId,
          filename: status.filename,
          age: Math.round(age / (60 * 60 * 1000)) + ' hours'
        });
        
        // Delete file if it exists
        if (status.path && fs.existsSync(status.path)) {
          fs.unlinkSync(status.path);
        }
        
        // Clean up
        this.fileUploads.delete(fileId);
        this.fileChunks.delete(fileId);
      }
    }
  }
  
  /**
   * Start cleanup interval
   */
  startCleanupInterval(interval: number = 60 * 60 * 1000): NodeJS.Timeout {
    return setInterval(() => {
      try {
        this.cleanupExpiredUploads();
      } catch (error) {
        logger.error('Error in cleanup interval', error);
      }
    }, interval);
  }
}

// Export singleton instance
export const fileChunking = new FileChunkingService();
export default fileChunking;