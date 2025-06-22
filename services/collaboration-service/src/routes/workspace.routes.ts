import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { 
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateMemberRole
} from '../controllers/workspace.controller';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Workspace routes
router.post('/', createWorkspace);
router.get('/', getWorkspaces);
router.get('/:id', getWorkspaceById);
router.put('/:id', updateWorkspace);
router.delete('/:id', deleteWorkspace);

// Workspace member management
router.post('/:id/members', addWorkspaceMember);
router.delete('/:id/members/:userId', removeWorkspaceMember);
router.put('/:id/members/:userId/role', updateMemberRole);

export { router as workspaceRoutes };