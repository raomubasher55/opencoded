import { Router } from 'express';
import { ExtensionController } from '../controllers/extension.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { enterpriseMiddleware } from '../middleware/enterprise.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB limit
  } 
});

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all extensions (public)
router.get(
  '/',
  ExtensionController.getExtensions
);

// Search extensions (public)
router.get(
  '/search',
  ExtensionController.searchExtensions
);

// Get user's installed extensions (authenticated)
router.get(
  '/user',
  ExtensionController.getUserExtensions
);

// Create a new extension (authenticated)
router.post(
  '/',
  upload.single('package'),
  validationMiddleware({
    body: {
      name: { type: 'string', required: true, pattern: /^[a-z0-9-]+$/ },
      displayName: { type: 'string', required: true },
      description: { type: 'string', required: true },
      version: { type: 'string', required: true, pattern: /^\\d+\\.\\d+\\.\\d+$/ },
      type: { type: 'string', required: true, enum: ['tool', 'template', 'integration'] },
      entryPoint: { type: 'string', required: true },
      schema: { type: 'object', required: true }
    }
  }),
  ExtensionController.createExtension
);

// Get extension by ID (public)
router.get(
  '/:id',
  ExtensionController.getExtensionById
);

// Get extension by name (public)
router.get(
  '/name/:name',
  ExtensionController.getExtensionByName
);

// Update an existing extension (authenticated + owner)
router.put(
  '/:id',
  validationMiddleware({
    body: {
      displayName: { type: 'string', optional: true },
      description: { type: 'string', optional: true },
      homepage: { type: 'string', optional: true },
      repository: { type: 'string', optional: true },
      license: { type: 'string', optional: true },
      keywords: { type: 'array', optional: true }
    }
  }),
  ExtensionController.updateExtension
);

// Update extension status (admin only)
router.patch(
  '/:id/status',
  validationMiddleware({
    body: {
      status: { 
        type: 'string', 
        required: true, 
        enum: ['pending_review', 'approved', 'rejected', 'deprecated'] 
      },
      reason: { type: 'string', optional: true }
    }
  }),
  ExtensionController.updateExtensionStatus
);

// Delete an extension (authenticated + owner or admin)
router.delete(
  '/:id',
  ExtensionController.deleteExtension
);

// Get extension versions (public)
router.get(
  '/:id/versions',
  ExtensionController.getExtensionVersions
);

// Get specific extension version (public)
router.get(
  '/:id/versions/:version',
  ExtensionController.getExtensionVersion
);

// Create a new extension version (authenticated + owner)
router.post(
  '/:id/versions',
  upload.single('package'),
  validationMiddleware({
    body: {
      version: { type: 'string', required: true, pattern: /^\\d+\\.\\d+\\.\\d+$/ },
      description: { type: 'string', required: true },
      changelog: { type: 'string', required: true }
    }
  }),
  ExtensionController.createExtensionVersion
);

// Download extension package (public)
router.get(
  '/:id/versions/:version/download',
  ExtensionController.downloadExtensionPackage
);

// Rate an extension (authenticated)
router.post(
  '/:id/ratings',
  validationMiddleware({
    body: {
      rating: { type: 'number', required: true, min: 1, max: 5 },
      review: { type: 'string', optional: true }
    }
  }),
  ExtensionController.rateExtension
);

// Get extension ratings (public)
router.get(
  '/:id/ratings',
  ExtensionController.getExtensionRatings
);

// Install an extension (authenticated)
router.post(
  '/:id/install',
  validationMiddleware({
    body: {
      version: { type: 'string', optional: true, pattern: /^\\d+\\.\\d+\\.\\d+$/ }
    }
  }),
  ExtensionController.installExtension
);

// Uninstall an extension (authenticated)
router.delete(
  '/:id/install',
  ExtensionController.uninstallExtension
);

// Update extension settings (authenticated)
router.put(
  '/:id/settings',
  validationMiddleware({
    body: {
      settings: { type: 'object', required: true }
    }
  }),
  ExtensionController.updateExtensionSettings
);

export { router as extensionRoutes };