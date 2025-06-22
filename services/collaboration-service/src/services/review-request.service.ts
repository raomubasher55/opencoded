import { ReviewRequestModel, IReviewRequest } from '../models/review-request.model';
import { ThreadModel } from '../models/thread.model';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('review-request-service');

export interface CreateReviewRequestParams {
  sessionId: string;
  title: string;
  description: string;
  createdBy: string;
  reviewers: { userId: string; username: string }[];
  files: { fileId: string; path: string }[];
  dueDate?: Date;
}

export interface UpdateReviewRequestParams {
  reviewId: string;
  title?: string;
  description?: string;
  status?: 'draft' | 'open' | 'approved' | 'changes_requested' | 'closed';
  reviewers?: { userId: string; username: string }[];
  files?: { fileId: string; path: string }[];
  dueDate?: Date;
}

export interface ReviewerUpdateParams {
  reviewId: string;
  userId: string;
  status: 'approved' | 'requested_changes' | 'declined';
  comments?: string;
}

export class ReviewRequestService {
  /**
   * Create a new review request
   */
  async createReviewRequest(params: CreateReviewRequestParams): Promise<IReviewRequest> {
    try {
      const reviewers = params.reviewers.map(reviewer => ({
        userId: reviewer.userId,
        username: reviewer.username,
        status: 'pending',
        assignedAt: new Date()
      }));
      
      const reviewRequest = await ReviewRequestModel.create({
        ...params,
        reviewers,
        status: 'draft',
        threadIds: []
      });
      
      return reviewRequest;
    } catch (error) {
      logger.error('Error creating review request', error);
      throw error;
    }
  }
  
  /**
   * Get review requests for a session
   */
  async getSessionReviewRequests(sessionId: string, status?: string): Promise<IReviewRequest[]> {
    try {
      const query: any = { sessionId };
      
      if (status) {
        query.status = status;
      }
      
      return await ReviewRequestModel.find(query)
        .sort({ createdAt: -1 })
        .lean();
    } catch (error) {
      logger.error('Error getting session review requests', error);
      throw error;
    }
  }
  
  /**
   * Get review requests for a user (as creator or reviewer)
   */
  async getUserReviewRequests(userId: string, role: 'creator' | 'reviewer'): Promise<IReviewRequest[]> {
    try {
      const query = role === 'creator' 
        ? { createdBy: userId }
        : { 'reviewers.userId': userId };
      
      return await ReviewRequestModel.find(query)
        .sort({ createdAt: -1 })
        .lean();
    } catch (error) {
      logger.error('Error getting user review requests', error);
      throw error;
    }
  }
  
  /**
   * Get a review request by ID
   */
  async getReviewRequest(reviewId: string): Promise<IReviewRequest | null> {
    try {
      return await ReviewRequestModel.findById(reviewId).lean();
    } catch (error) {
      logger.error('Error getting review request', error);
      throw error;
    }
  }
  
  /**
   * Update a review request
   */
  async updateReviewRequest(params: UpdateReviewRequestParams): Promise<IReviewRequest | null> {
    try {
      const { reviewId, ...updateData } = params;
      
      const reviewRequest = await ReviewRequestModel.findByIdAndUpdate(
        reviewId,
        updateData,
        { new: true }
      );
      
      return reviewRequest;
    } catch (error) {
      logger.error('Error updating review request', error);
      throw error;
    }
  }
  
  /**
   * Submit a review request (change status from draft to open)
   */
  async submitReviewRequest(reviewId: string): Promise<IReviewRequest | null> {
    try {
      const reviewRequest = await ReviewRequestModel.findByIdAndUpdate(
        reviewId,
        { status: 'open' },
        { new: true }
      );
      
      return reviewRequest;
    } catch (error) {
      logger.error('Error submitting review request', error);
      throw error;
    }
  }
  
  /**
   * Update reviewer status
   */
  async updateReviewerStatus(params: ReviewerUpdateParams): Promise<IReviewRequest | null> {
    try {
      const { reviewId, userId, status, comments } = params;
      
      // Update the specific reviewer's status
      const reviewRequest = await ReviewRequestModel.findOneAndUpdate(
        { _id: reviewId, 'reviewers.userId': userId },
        { 
          $set: { 
            'reviewers.$.status': status,
            'reviewers.$.comments': comments,
            'reviewers.$.completedAt': new Date()
          } 
        },
        { new: true }
      );
      
      if (!reviewRequest) {
        return null;
      }
      
      // If all reviewers have responded, update the overall status
      if (!reviewRequest.reviewers.some(r => r.status === 'pending')) {
        const hasChangesRequested = reviewRequest.reviewers.some(r => r.status === 'requested_changes');
        const newStatus = hasChangesRequested ? 'changes_requested' : 'approved';
        
        await ReviewRequestModel.findByIdAndUpdate(
          reviewId,
          { status: newStatus }
        );
        
        // Fetch and return the updated document
        return await ReviewRequestModel.findById(reviewId);
      }
      
      return reviewRequest;
    } catch (error) {
      logger.error('Error updating reviewer status', error);
      throw error;
    }
  }
  
  /**
   * Add a thread to a review request
   */
  async addThreadToReview(reviewId: string, threadId: string): Promise<IReviewRequest | null> {
    try {
      return await ReviewRequestModel.findByIdAndUpdate(
        reviewId,
        { $addToSet: { threadIds: threadId } },
        { new: true }
      );
    } catch (error) {
      logger.error('Error adding thread to review', error);
      throw error;
    }
  }
  
  /**
   * Close a review request
   */
  async closeReviewRequest(reviewId: string): Promise<IReviewRequest | null> {
    try {
      return await ReviewRequestModel.findByIdAndUpdate(
        reviewId,
        { status: 'closed' },
        { new: true }
      );
    } catch (error) {
      logger.error('Error closing review request', error);
      throw error;
    }
  }
  
  /**
   * Get threads associated with a review request
   */
  async getReviewThreads(reviewId: string): Promise<any[]> {
    try {
      const review = await ReviewRequestModel.findById(reviewId);
      
      if (!review || !review.threadIds.length) {
        return [];
      }
      
      return await ThreadModel.find({
        _id: { $in: review.threadIds }
      }).lean();
    } catch (error) {
      logger.error('Error getting review threads', error);
      throw error;
    }
  }
}