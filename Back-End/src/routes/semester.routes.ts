import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { createSemester, deleteSemester, getSemesters, updateSemester } from '../controllers/semester.controller';

const router = Router();

router.use(authenticate);
router.get('/', getSemesters);
router.post('/', createSemester);
router.put('/:id', updateSemester);
router.delete('/:id', deleteSemester);

export default router;
