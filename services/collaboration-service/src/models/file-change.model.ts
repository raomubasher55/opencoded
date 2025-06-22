import mongoose, { Document, Schema } from 'mongoose';

export interface IFileChange extends Document {
  sessionId: string;
  fileId: string;
  userId: string;
  content: string;
  version: number;
  operations?: any[];
  timestamp: Date;
}

const FileChangeSchema = new Schema<IFileChange>(
  {
    sessionId: {
      type: String,
      required: true
    },
    fileId: {
      type: String,
      required: true
    },
    userId: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    version: {
      type: Number,
      required: true
    },
    operations: {
      type: Schema.Types.Mixed
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes
FileChangeSchema.index({ sessionId: 1, fileId: 1, version: 1 }, { unique: true });
FileChangeSchema.index({ sessionId: 1, fileId: 1, timestamp: -1 });

export const FileChangeModel = mongoose.model<IFileChange>('FileChange', FileChangeSchema);