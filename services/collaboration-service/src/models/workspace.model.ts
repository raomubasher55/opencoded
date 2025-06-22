import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkspaceMember {
  userId: string;
  username: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: Date;
}

export interface IWorkspaceSettings {
  ignoredPatterns?: string[];
  language?: string;
  fileTypes?: string[];
  autoSync?: boolean;
  [key: string]: any;
}

export interface IWorkspace extends Document {
  name: string;
  description?: string;
  basePath: string;
  members: IWorkspaceMember[];
  visibility: 'private' | 'team' | 'public';
  teamId?: string;
  settings: IWorkspaceSettings;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>({
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
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const WorkspaceSchema = new Schema<IWorkspace>(
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
    basePath: {
      type: String,
      required: true
    },
    members: [WorkspaceMemberSchema],
    visibility: {
      type: String,
      enum: ['private', 'team', 'public'],
      default: 'private'
    },
    teamId: {
      type: String
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {
        ignoredPatterns: ['node_modules', '.git', 'dist', 'build'],
        autoSync: true
      }
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
WorkspaceSchema.index({ createdBy: 1 });
WorkspaceSchema.index({ 'members.userId': 1 });
WorkspaceSchema.index({ teamId: 1 });
WorkspaceSchema.index({ visibility: 1 });

export const WorkspaceModel = mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);