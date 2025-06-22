import express from 'express';
import { ReviewRequestController } from '../controllers/review-request.controller';
import { authenticateJWT as authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();
const reviewRequestController = new ReviewRequestController();

// Create a new review request
router.post(
  '/',
  authMiddleware,
  reviewRequestController.createReviewRequest.bind(reviewRequestController)
);

// Get review requests for a session
router.get(
  '/session/:sessionId',
  authMiddleware,
  reviewRequestController.getSessionReviewRequests.bind(reviewRequestController)
);

// Get review requests for the current user
router.get(
  '/user',
  authMiddleware,
  reviewRequestController.getUserReviewRequests.bind(reviewRequestController)
);

// Get a review request by ID
router.get(
  '/:reviewId',
  authMiddleware,
  reviewRequestController.getReviewRequest.bind(reviewRequestController)
);

// Update a review request
router.put(
  '/:reviewId',
  authMiddleware,
  reviewRequestController.updateReviewRequest.bind(reviewRequestController)
);

// Submit a review request (change from draft to open)
router.post(
  '/:reviewId/submit',
  authMiddleware,
  reviewRequestController.submitReviewRequest.bind(reviewRequestController)
);

// Update reviewer status
router.post(
  '/:reviewId/review',
  authMiddleware,
  reviewRequestController.updateReviewerStatus.bind(reviewRequestController)
);

// Add a thread to a review request
router.post(
  '/:reviewId/thread/:threadId',
  authMiddleware,
  reviewRequestController.addThreadToReview.bind(reviewRequestController)
);

// Close a review request
router.post(
  '/:reviewId/close',
  authMiddleware,
  reviewRequestController.closeReviewRequest.bind(reviewRequestController)
);

// Get threads associated with a review request
router.get(
  '/:reviewId/threads',
  authMiddleware,
  reviewRequestController.getReviewThreads.bind(reviewRequestController)
);

export default router;