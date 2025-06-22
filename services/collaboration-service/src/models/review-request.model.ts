import mongoose, { Document, Schema } from 'mongoose';

export interface IReviewerAssignment {
  userId: string;
  username: string;
  status: 'pending' | 'approved' | 'requested_changes' | 'declined';
  assignedAt: Date;
  completedAt?: Date;
  comments?: string; // Optional general comments
}

export interface IReviewRequest extends Document {
  sessionId: string;
  title: string;
  description: string;
  createdBy: string;
  reviewers: IReviewerAssignment[];
  status: 'draft' | 'open' | 'approved' | 'changes_requested' | 'closed';
  files: {
    fileId: string;
    path: string;
  }[];
  threadIds: string[];
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewerAssignmentSchema = new Schema<IReviewerAssignment>({
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'requested_changes', 'declined'],
    default: 'pending'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  comments: {
    type: String
  }
});

const ReviewRequestSchema = new Schema<IReviewRequest>(
  {
    sessionId: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    createdBy: {
      type: String,
      required: true
    },
    reviewers: [ReviewerAssignmentSchema],
    status: {
      type: String,
      enum: ['draft', 'open', 'approved', 'changes_requested', 'closed'],
      default: 'draft'
    },
    files: [{
      fileId: {
        type: String,
        required: true
      },
      path: {
        type: String,
        required: true
      }
    }],
    threadIds: [{
      type: String
    }],
    dueDate: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes
ReviewRequestSchema.index({ sessionId: 1 });
ReviewRequestSchema.index({ createdBy: 1 });
ReviewRequestSchema.index({ status: 1 });
ReviewRequestSchema.index({ 'reviewers.userId': 1 });

export const ReviewRequestModel = mongoose.model<IReviewRequest>('ReviewRequest', ReviewRequestSchema);