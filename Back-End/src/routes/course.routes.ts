import { Router } from 'express';
import { createCourse, getCourses, getCourseById, updateCourse, deleteCourse, previewCourseOutline, saveCourseOutline } from '../controllers/course.controller';
import { authenticate } from '../middleware/auth.middleware';
import { limitChatRequests } from '../middleware/chat-rate-limit.middleware';

const router = Router();

router.use(authenticate); // Protected routes

router.post('/', createCourse);
router.post('/:id/outline-preview', limitChatRequests, previewCourseOutline);
router.put('/:id/outline', saveCourseOutline);
router.get('/', getCourses);
router.get('/:id', getCourseById);
router.put('/:id', updateCourse);
router.delete('/:id', deleteCourse);

export default router;
