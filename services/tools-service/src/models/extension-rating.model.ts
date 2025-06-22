import mongoose, { Schema, Document } from 'mongoose';

export interface IExtensionRating extends Document {
  extensionId: string;
  userId: string;
  rating: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExtensionRatingSchema = new Schema({
  extensionId: {
    type: Schema.Types.ObjectId,
    ref: 'Extension',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure uniqueness of rating per user per extension
ExtensionRatingSchema.index({ extensionId: 1, userId: 1 }, { unique: true });

// Index for faster searches
ExtensionRatingSchema.index({ extensionId: 1 });
ExtensionRatingSchema.index({ userId: 1 });
ExtensionRatingSchema.index({ rating: -1 });

export const ExtensionRatingModel = mongoose.model<IExtensionRating>('ExtensionRating', ExtensionRatingSchema);