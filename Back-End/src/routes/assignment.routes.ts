import { Router } from 'express';
import { 
  createAssignment, 
  getAssignments, 
  getAssignmentById, 
  addAssignmentTask,
  updateAssignment,
  deleteAssignment,
  toggleAssignmentTask,
  deleteAssignmentTask
} from '../controllers/assignment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { toggleAssignmentStatus } from '../controllers/assignment.controller';

const router = Router();

router.use(authenticate);

router.post('/', createAssignment);
router.get('/', getAssignments);
router.get('/:id', getAssignmentById);
router.put('/:id', updateAssignment);
router.patch('/:id/status', toggleAssignmentStatus);
router.delete('/:id', deleteAssignment);

// Tasks / Milestones
router.post('/:id/tasks', addAssignmentTask);
router.patch('/:id/tasks/:taskId', toggleAssignmentTask);
router.delete('/:id/tasks/:taskId', deleteAssignmentTask);

export default router;