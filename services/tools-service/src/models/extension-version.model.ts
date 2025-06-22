import mongoose, { Schema, Document } from 'mongoose';
import { ExtensionStatus } from './extension.model';

export interface IExtensionVersion extends Document {
  extensionId: string;
  version: string;
  description: string;
  changelog: string;
  dependencies: {
    name: string;
    version: string;
  }[];
  entryPoint: string;
  schema: any;
  status: ExtensionStatus;
  packageUrl: string;
  sha256: string;
  size: number;
  createdAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

const ExtensionVersionSchema = new Schema({
  extensionId: {
    type: Schema.Types.ObjectId,
    ref: 'Extension',
    required: true
  },
  version: {
    type: String,
    required: true,
    match: /^\\d+\\.\\d+\\.\\d+$/
  },
  description: {
    type: String,
    required: true
  },
  changelog: {
    type: String,
    required: true
  },
  dependencies: [{
    name: {
      type: String,
      required: true
    },
    version: {
      type: String,
      required: true
    }
  }],
  entryPoint: {
    type: String,
    required: true
  },
  schema: {
    type: Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(ExtensionStatus),
    default: ExtensionStatus.PENDING_REVIEW
  },
  packageUrl: {
    type: String,
    required: true
  },
  sha256: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: Date,
  rejectedAt: Date,
  rejectionReason: String
}, {
  timestamps: true
});

// Ensure uniqueness of version per extension
ExtensionVersionSchema.index({ extensionId: 1, version: 1 }, { unique: true });

// Index for faster searches
ExtensionVersionSchema.index({ status: 1 });
ExtensionVersionSchema.index({ createdAt: -1 });

export const ExtensionVersionModel = mongoose.model<IExtensionVersion>('ExtensionVersion', ExtensionVersionSchema);