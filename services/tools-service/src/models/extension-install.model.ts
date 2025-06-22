import mongoose, { Schema, Document } from 'mongoose';

export interface IExtensionInstall extends Document {
  extensionId: string;
  userId: string;
  version: string;
  installedAt: Date;
  status: 'active' | 'disabled' | 'uninstalled';
  lastUsedAt?: Date;
  uninstalledAt?: Date;
  settings?: any;
}

const ExtensionInstallSchema = new Schema({
  extensionId: {
    type: Schema.Types.ObjectId,
    ref: 'Extension',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  version: {
    type: String,
    required: true
  },
  installedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'disabled', 'uninstalled'],
    default: 'active'
  },
  lastUsedAt: Date,
  uninstalledAt: Date,
  settings: Schema.Types.Mixed
});

// Ensure uniqueness of installation per user per extension
ExtensionInstallSchema.index({ extensionId: 1, userId: 1 }, { unique: true });

// Index for faster searches
ExtensionInstallSchema.index({ userId: 1 });
ExtensionInstallSchema.index({ status: 1 });
ExtensionInstallSchema.index({ installedAt: -1 });
ExtensionInstallSchema.index({ lastUsedAt: -1 });

export const ExtensionInstallModel = mongoose.model<IExtensionInstall>('ExtensionInstall', ExtensionInstallSchema);