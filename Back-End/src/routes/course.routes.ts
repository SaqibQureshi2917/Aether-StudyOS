import { Router } from 'express';
import { createCourse, getMyCourses } from '../controllers/course.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate); // Protected routes

router.post('/', createCourse);
router.get('/', getMyCourses);

export default router;