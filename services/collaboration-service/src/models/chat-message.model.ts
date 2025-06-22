import mongoose, { Document, Schema } from 'mongoose';

export interface IChatMessage extends Document {
  sessionId: string;
  userId: string;
  username: string;
  text: string;
  replyToId?: string;
  attachments?: string[];
  codeSnippet?: {
    language: string;
    code: string;
    fileName?: string;
  };
  timestamp: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    sessionId: {
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
    text: {
      type: String,
      required: true,
      trim: true
    },
    replyToId: {
      type: String
    },
    attachments: {
      type: [String]
    },
    codeSnippet: {
      language: String,
      code: String,
      fileName: String
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
ChatMessageSchema.index({ sessionId: 1, timestamp: 1 });
ChatMessageSchema.index({ replyToId: 1 });

export const ChatMessageModel = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);