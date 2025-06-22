import crypto from 'crypto';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('secure-data');

/**
 * Types of sensitive data for enterprise deployments
 */
export enum SensitiveDataType {
  API_KEY = 'api_key',
  SECRET = 'secret',
  PERSONAL_INFO = 'personal_info',
  CREDENTIALS = 'credentials',
  PAYMENT_INFO = 'payment_info'
}

/**
 * Enterprise-grade secure data handling service
 */
class SecureDataService {
  private encryptionKey: Buffer;
  private hmacKey: Buffer;
  
  constructor() {
    // In a real implementation, these keys would be securely loaded from a key management service
    const masterKey = process.env.MASTER_KEY || 'default-master-key-for-development-only';
    
    // Derive separate keys for encryption and HMAC using HKDF
    this.encryptionKey = this.deriveKey(masterKey, 'encryption', 32);
    this.hmacKey = this.deriveKey(masterKey, 'hmac', 32);
    
    logger.info('Secure data service initialized');
  }
  
  /**
   * Derive a key using HKDF
   */
  private deriveKey(masterKey: string, purpose: string, length: number): Buffer {
    // Simple HKDF implementation
    const info = Buffer.from(`opencode-${purpose}`);
    const salt = Buffer.from('opencode-secure-data-salt');
    
    // Extract step
    const hmac = crypto.createHmac('sha256', salt);
    hmac.update(masterKey);
    const prk = hmac.digest();
    
    // Expand step
    const result = Buffer.alloc(length);
    let previousBlock = Buffer.alloc(0);
    let offset = 0;
    let counter = 1;
    
    while (offset < length) {
      const hmac = crypto.createHmac('sha256', prk);
      hmac.update(Buffer.concat([previousBlock, info, Buffer.from([counter++])]));
      previousBlock = hmac.digest();
      previousBlock.copy(result, offset, 0, Math.min(previousBlock.length, length - offset));
      offset += previousBlock.length;
    }
    
    return result;
  }
  
  /**
   * Encrypt sensitive data
   */
  encrypt(data: string, type: SensitiveDataType): { encrypted: string; iv: string; tag: string } {
    try {
      // Generate IV
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      
      // Add type as authenticated additional data
      cipher.setAAD(Buffer.from(type));
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag().toString('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag
      };
    } catch (error) {
      logger.error('Encryption error', error);
      throw new Error('Failed to encrypt data');
    }
  }
  
  /**
   * Decrypt sensitive data
   */
  decrypt(encrypted: string, iv: string, tag: string, type: SensitiveDataType): string {
    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        Buffer.from(iv, 'hex')
      );
      
      // Set authentication tag
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      // Add type as authenticated additional data
      decipher.setAAD(Buffer.from(type));
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption error', error);
      throw new Error('Failed to decrypt data: Data may have been tampered with');
    }
  }
  
  /**
   * Create a secure hash for sensitive data
   */
  hash(data: string): string {
    // Use a secure hashing algorithm with the HMAC key
    const hmac = crypto.createHmac('sha256', this.hmacKey);
    hmac.update(data);
    return hmac.digest('hex');
  }
  
  /**
   * Secure compare for sensitive data
   */
  secureCompare(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch (error) {
      // If buffers are different lengths, timingSafeEqual throws an error
      return false;
    }
  }
  
  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Generate a strong password
   */
  generatePassword(options: {
    length?: number;
    includeUppercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  } = {}): string {
    const {
      length = 16,
      includeUppercase = true,
      includeNumbers = true,
      includeSymbols = true
    } = options;
    
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let charset = lowercase;
    if (includeUppercase) charset += uppercase;
    if (includeNumbers) charset += numbers;
    if (includeSymbols) charset += symbols;
    
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      const index = randomBytes[i] % charset.length;
      password += charset[index];
    }
    
    return password;
  }
  
  /**
   * Mask sensitive data for logging or display
   */
  mask(data: string, type: SensitiveDataType): string {
    switch (type) {
      case SensitiveDataType.API_KEY:
      case SensitiveDataType.SECRET:
        // Only show first 4 and last 4 characters
        if (data.length <= 8) {
          return '********';
        }
        return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4);
        
      case SensitiveDataType.CREDENTIALS:
        // Complete masking
        return '*'.repeat(data.length);
        
      case SensitiveDataType.PERSONAL_INFO:
        // Partial masking, show first character and last character
        if (data.length <= 2) {
          return '**';
        }
        return data.substring(0, 1) + '*'.repeat(data.length - 2) + data.substring(data.length - 1);
        
      case SensitiveDataType.PAYMENT_INFO:
        // For credit cards, show only last 4 digits
        if (data.length >= 13 && data.length <= 19 && /^\d+$/.test(data)) {
          return '*'.repeat(data.length - 4) + data.substring(data.length - 4);
        }
        return '*'.repeat(data.length);
        
      default:
        return '*'.repeat(data.length);
    }
  }
}

// Create singleton instance
export const secureData = new SecureDataService();
export default secureData;