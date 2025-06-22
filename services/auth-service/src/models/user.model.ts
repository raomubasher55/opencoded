import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User as UserType, ApiKey } from '@opencode/shared-types';

// OAuth profiles interface
interface OAuthProfiles {
  github?: string;
  google?: string;
}

// Extend the User interface for Mongoose
interface UserDocument extends Omit<UserType, 'id'>, Document {
  oauthProfiles?: OAuthProfiles;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateApiKey(name: string): ApiKey;
}

// Define ApiKey schema
const ApiKeySchema = new Schema<ApiKey>({
  id: { type: String, required: true },
  key: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

// Define OAuth Profiles schema
const OAuthProfilesSchema = new Schema({
  github: { type: String },
  google: { type: String }
}, { _id: false });

// Define User schema
const UserSchema = new Schema<UserDocument>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  apiKeys: [ApiKeySchema],
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  oauthProfiles: { type: OAuthProfilesSchema, default: {} },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamps on save
UserSchema.pre('save', function (next: mongoose.CallbackWithoutResultAndOptionalError) {
  if (this.isModified('passwordHash') && this.passwordHash) {
    // Hash password if it's modified
    const salt = bcrypt.genSaltSync(10);
    this.passwordHash = bcrypt.hashSync(this.passwordHash, salt);
  }
  
  this.updatedAt = new Date();
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (this: UserDocument, candidatePassword: string): Promise<boolean> {
  try {
    if (!this.passwordHash) {
      console.error('comparePassword: passwordHash is empty');
      return false;
    }
    
    // Handle edge case for development/testing where passwords might not be hashed
    if (process.env.NODE_ENV === 'development' && candidatePassword === this.passwordHash) {
      console.log('Development mode: Direct password match');
      return true;
    }
    
    // Normal password comparison
    const isMatch = await bcrypt.compare(candidatePassword, this.passwordHash);
    return isMatch;
  } catch (error: any) {
    console.error(`Error comparing passwords: ${error.message}`);
    return false;
  }
};

// Generate API key method
UserSchema.methods.generateApiKey = function (this: UserDocument, name: string): ApiKey {
  const keyBuffer = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    keyBuffer[i] = Math.floor(Math.random() * 256);
  }
  
  const apiKey: ApiKey = {
    id: new mongoose.Types.ObjectId().toString(),
    key: keyBuffer.toString('hex'),
    name,
    createdAt: new Date()
  };
  
  if (this.apiKeys) {
    this.apiKeys.push(apiKey);
  } else {
    this.apiKeys = [apiKey];
  }
  return apiKey;
};

// Create and export the model
export const UserModel = mongoose.model<UserDocument>('User', UserSchema);