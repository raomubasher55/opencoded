import mongoose, { Document, Schema } from 'mongoose';

export interface IMention {
  userId: string;
  username: string;
}

export interface IComment extends Document {
  sessionId: string;
  fileId: string;
  userId: string;
  username: string;
  content: string;
  lineNumber?: number;
  charStart?: number;
  charEnd?: number;
  codeSnippet?: string;
  parentId?: string;
  threadId?: string;
  mentions?: IMention[];
  status?: 'open' | 'resolved' | 'won\'t fix';
  createdAt: Date;
  updatedAt: Date;
}

const MentionSchema = new Schema<IMention>({
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  }
});

const CommentSchema = new Schema<IComment>(
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
    username: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    lineNumber: {
      type: Number
    },
    charStart: {
      type: Number
    },
    charEnd: {
      type: Number
    },
    codeSnippet: {
      type: String
    },
    parentId: {
      type: String
    },
    threadId: {
      type: String
    },
    mentions: [MentionSchema],
    status: {
      type: String,
      enum: ['open', 'resolved', 'won\'t fix'],
      default: 'open'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
CommentSchema.index({ sessionId: 1, fileId: 1 });
CommentSchema.index({ sessionId: 1, threadId: 1 });
CommentSchema.index({ parentId: 1 });
CommentSchema.index({ 'mentions.userId': 1 });
CommentSchema.index({ userId: 1 });

export const CommentModel = mongoose.model<IComment>('Comment', CommentSchema);