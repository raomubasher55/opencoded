import mongoose, { Document, Schema } from 'mongoose';
import { Session, Message, ToolCall, ToolResult } from '@opencode/shared-types';

// Create a schema for tool result
const ToolResultSchema = new Schema({
  success: { type: Boolean, required: true },
  output: { type: String },
  error: { type: String },
  metadata: { type: Schema.Types.Mixed }
});

// Create a schema for tool calls
const ToolCallSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  arguments: { type: Schema.Types.Mixed, required: true },
  result: { type: ToolResultSchema }
});

// Create a schema for messages
const MessageSchema = new Schema({
  id: { type: String, required: true },
  sessionId: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['user', 'assistant', 'system', 'tool'],
    required: true 
  },
  content: { type: String, required: true },
  toolCalls: [ToolCallSchema],
  timestamp: { type: Date, default: Date.now }
});

// Create a schema for session tags
const TagSchema = new Schema({
  name: { type: String, required: true },
  color: { type: String }
});

// Define the Session schema
export interface SessionDocument extends Document, Omit<Session, 'id'> {
  _id: string;
  userId: string;
  title: string;
  messages: Message[];
  tags?: Array<{ name: string; color?: string }>;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  metadata?: Record<string, any>;
}

const SessionSchema = new Schema<SessionDocument>({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  messages: [MessageSchema],
  tags: [TagSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastAccessedAt: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed }
});

// Create indexes for faster lookups
SessionSchema.index({ userId: 1, createdAt: -1 });
SessionSchema.index({ updatedAt: -1 });

// Set updatedAt on save
SessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Helper methods to convert between MongoDB document and our type
SessionSchema.methods.toClientSession = function(): Session {
  const session = this.toObject();
  return {
    ...session,
    id: session._id.toString()
  };
};

// Create and export the model
export const SessionModel = mongoose.model<SessionDocument>('Session', SessionSchema);

// Function to convert a MongoDB document to a Session object
export function documentToSession(doc: SessionDocument): Session {
  const sessionObj = doc.toObject();
  return {
    ...sessionObj,
    id: sessionObj._id.toString()
  };
}