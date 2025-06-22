import { Request, Response } from 'express';
import { ReviewRequestService } from '../services/review-request.service';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('review-request-controller');
const reviewRequestService = new ReviewRequestService();

export class ReviewRequestController {
  /**
   * Create a new review request
   */
  async createReviewRequest(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, title, description, reviewers, files, dueDate } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      
      const reviewRequest = await reviewRequestService.createReviewRequest({
        sessionId,
        title,
        description,
        createdBy: userId,
        reviewers,
        files,
        dueDate: dueDate ? new Date(dueDate) : undefined
      });
      
      res.status(201).json(reviewRequest);
    } catch (error: any) {
      logger.error('Error creating review request', error);
      res.status(500).json({ error: error.message || 'Error creating review request' });
    }
  }
  
  /**
   * Get review requests for a session
   */
  async getSessionReviewRequests(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { status } = req.query;
      
      const reviewRequests = await reviewRequestService.getSessionReviewRequests(
        sessionId, 
        status as string | undefined
      );
      
      res.json({ reviewRequests });
    } catch (error: any) {
      logger.error('Error getting session review requests', error);
      res.status(500).json({ error: error.message || 'Error getting session review requests' });
    }
  }
  
  /**
   * Get review requests for a user (as creator or reviewer)
   */
  async getUserReviewRequests(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { role } = req.query;
      
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      
      const reviewRole = role === 'reviewer' ? 'reviewer' : 'creator';
      
      const reviewRequests = await reviewRequestService.getUserReviewRequests(
        userId,
        reviewRole as 'creator' | 'reviewer'
      );
      
      res.json({ reviewRequests });
    } catch (error: any) {
      logger.error('Error getting user review requests', error);
      res.status(500).json({ error: error.message || 'Error getting user review requests' });
    }
  }
  
  /**
   * Get a review request by ID
   */
  async getReviewRequest(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      
      const reviewRequest = await reviewRequestService.getReviewRequest(reviewId);
      
      if (!reviewRequest) {
        res.status(404).json({ error: 'Review request not found' });
        return;
      }
      
      res.json(reviewRequest);
    } catch (error: any) {
      logger.error('Error getting review request', error);
      res.status(500).json({ error: error.message || 'Error getting review request' });
    }
  }
  
  /**
   * Update a review request
   */
  async updateReviewRequest(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const { title, description, status, reviewers, files, dueDate } = req.body;
      
      const reviewRequest = await reviewRequestService.updateReviewRequest({
        reviewId,
        title,
        description,
        status,
        reviewers,
        files,
        dueDate: dueDate ? new Date(dueDate) : undefined
      });
      
      if (!reviewRequest) {
        res.status(404).json({ error: 'Review request not found' });
        return;
      }
      
      res.json(reviewRequest);
    } catch (error: any) {
      logger.error('Error updating review request', error);
      res.status(500).json({ error: error.message || 'Error updating review request' });
    }
  }
  
  /**
   * Submit a review request (change from draft to open)
   */
  async submitReviewRequest(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      
      const reviewRequest = await reviewRequestService.submitReviewRequest(reviewId);
      
      if (!reviewRequest) {
        res.status(404).json({ error: 'Review request not found' });
        return;
      }
      
      res.json(reviewRequest);
    } catch (error: any) {
      logger.error('Error submitting review request', error);
      res.status(500).json({ error: error.message || 'Error submitting review request' });
    }
  }
  
  /**
   * Update reviewer status
   */
  async updateReviewerStatus(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const { status, comments } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }
      
      const reviewRequest = await reviewRequestService.updateReviewerStatus({
        reviewId,
        userId,
        status,
        comments
      });
      
      if (!reviewRequest) {
        res.status(404).json({ error: 'Review request not found or user is not a reviewer' });
        return;
      }
      
      res.json(reviewRequest);
    } catch (error: any) {
      logger.error('Error updating reviewer status', error);
      res.status(500).json({ error: error.message || 'Error updating reviewer status' });
    }
  }
  
  /**
   * Add a thread to a review request
   */
  async addThreadToReview(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId, threadId } = req.params;
      
      const reviewRequest = await reviewRequestService.addThreadToReview(reviewId, threadId);
      
      if (!reviewRequest) {
        res.status(404).json({ error: 'Review request not found' });
        return;
      }
      
      res.json(reviewRequest);
    } catch (error: any) {
      logger.error('Error adding thread to review', error);
      res.status(500).json({ error: error.message || 'Error adding thread to review' });
    }
  }
  
  /**
   * Close a review request
   */
  async closeReviewRequest(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      
      const reviewRequest = await reviewRequestService.closeReviewRequest(reviewId);
      
      if (!reviewRequest) {
        res.status(404).json({ error: 'Review request not found' });
        return;
      }
      
      res.json(reviewRequest);
    } catch (error: any) {
      logger.error('Error closing review request', error);
      res.status(500).json({ error: error.message || 'Error closing review request' });
    }
  }
  
  /**
   * Get threads associated with a review request
   */
  async getReviewThreads(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      
      const threads = await reviewRequestService.getReviewThreads(reviewId);
      
      res.json({ threads });
    } catch (error: any) {
      logger.error('Error getting review threads', error);
      res.status(500).json({ error: error.message || 'Error getting review threads' });
    }
  }
}