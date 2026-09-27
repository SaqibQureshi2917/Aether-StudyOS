import { Router } from 'express';
import { uploadMaterial, getUserMaterials, downloadMaterial } from '../controllers/material.controller';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

// POST /api/v1/materials/upload
router.post('/upload', upload.single('file'), uploadMaterial);

// GET /api/v1/materials
router.get('/', getUserMaterials);
router.get('/:id/download', downloadMaterial);

export default router;
