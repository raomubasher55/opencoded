import mongoose, { Document, Schema } from 'mongoose';

export interface IThread extends Document {
  sessionId: string;
  fileId: string;
  title: string;
  createdBy: string;
  status: 'open' | 'resolved' | 'won\'t fix' | 'closed';
  participants: string[];
  lineNumber?: number;
  codeSnippet?: string;
  lastActivity: Date;
  reviewRequestId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>(
  {
    sessionId: {
      type: String,
      required: true
    },
    fileId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    createdBy: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['open', 'resolved', 'won\'t fix', 'closed'],
      default: 'open'
    },
    participants: [{
      type: String
    }],
    lineNumber: {
      type: Number
    },
    codeSnippet: {
      type: String
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    reviewRequestId: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
ThreadSchema.index({ sessionId: 1, fileId: 1 });
ThreadSchema.index({ status: 1 });
ThreadSchema.index({ createdBy: 1 });
ThreadSchema.index({ participants: 1 });
ThreadSchema.index({ reviewRequestId: 1 });

export const ThreadModel = mongoose.model<IThread>('Thread', ThreadSchema);