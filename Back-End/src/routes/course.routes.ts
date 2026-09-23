import { Router } from 'express';
import { createCourse, getCourses } from '../controllers/course.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate); // Protected routes

router.post('/', createCourse);
router.get('/', getCourses);

export default router;