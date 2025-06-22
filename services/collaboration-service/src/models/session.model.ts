import mongoose, { Document, Schema } from 'mongoose';

export interface ISessionParticipant {
  userId: string;
  username: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
}

export interface ISession extends Document {
  name: string;
  description?: string;
  participants: ISessionParticipant[];
  workspaceId?: string;
  isActive: boolean;
  visibility: 'private' | 'team' | 'public';
  teamId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SessionParticipantSchema = new Schema<ISessionParticipant>({
  userId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'editor', 'viewer'],
    default: 'viewer'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

const SessionSchema = new Schema<ISession>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    participants: [SessionParticipantSchema],
    workspaceId: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
    visibility: {
      type: String,
      enum: ['private', 'team', 'public'],
      default: 'private'
    },
    teamId: {
      type: String
    },
    createdBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
SessionSchema.index({ createdBy: 1 });
SessionSchema.index({ 'participants.userId': 1 });
SessionSchema.index({ teamId: 1 });
SessionSchema.index({ visibility: 1 });

export const SessionModel = mongoose.model<ISession>('Session', SessionSchema);