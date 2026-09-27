import { Router } from 'express';
import { createCourse, getCourses, updateCourse, deleteCourse } from '../controllers/course.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate); // Protected routes

router.post('/', createCourse);
router.get('/', getCourses);
router.put('/:id', updateCourse);
router.delete('/:id', deleteCourse);

export default router;
