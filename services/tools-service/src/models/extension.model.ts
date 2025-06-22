import mongoose, { Schema, Document } from 'mongoose';

export enum ExtensionType {
  TOOL = 'tool',
  TEMPLATE = 'template',
  INTEGRATION = 'integration'
}

export enum ExtensionStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DEPRECATED = 'deprecated'
}

export interface IExtension extends Document {
  name: string;
  displayName: string;
  description: string;
  version: string;
  type: ExtensionType;
  author: {
    id: string;
    username: string;
    email?: string;
  };
  repository?: string;
  homepage?: string;
  license?: string;
  keywords: string[];
  dependencies: {
    name: string;
    version: string;
  }[];
  entryPoint: string;
  schema: any;
  status: ExtensionStatus;
  rating: {
    average: number;
    count: number;
  };
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  pricing?: {
    type: 'free' | 'paid' | 'subscription';
    price?: number;
    currency?: string;
    trialDays?: number;
  };
}

const ExtensionSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    match: /^[a-z0-9-]+$/
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  version: {
    type: String,
    required: true,
    match: /^\\d+\\.\\d+\\.\\d+$/
  },
  type: {
    type: String,
    enum: Object.values(ExtensionType),
    required: true
  },
  author: {
    id: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    email: String
  },
  repository: String,
  homepage: String,
  license: String,
  keywords: [String],
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
  rating: {
    average: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  downloads: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  publishedAt: Date,
  approvedAt: Date,
  rejectedAt: Date,
  rejectionReason: String,
  pricing: {
    type: {
      type: String,
      enum: ['free', 'paid', 'subscription'],
      default: 'free'
    },
    price: Number,
    currency: String,
    trialDays: Number
  }
}, {
  timestamps: true
});

// Indexes for faster searches
ExtensionSchema.index({ name: 1 });
ExtensionSchema.index({ type: 1 });
ExtensionSchema.index({ status: 1 });
ExtensionSchema.index({ 'author.id': 1 });
ExtensionSchema.index({ keywords: 1 });
ExtensionSchema.index({ downloads: -1 });
ExtensionSchema.index({ 'rating.average': -1 });

export const ExtensionModel = mongoose.model<IExtension>('Extension', ExtensionSchema);