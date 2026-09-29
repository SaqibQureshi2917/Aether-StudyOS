"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const material_controller_1 = require("../controllers/material.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// POST /api/v1/materials/upload
router.post('/upload', upload_middleware_1.upload.single('file'), material_controller_1.uploadMaterial);
// GET /api/v1/materials
router.get('/', material_controller_1.getUserMaterials);
router.patch('/:id', material_controller_1.renameMaterial);
router.delete('/:id', material_controller_1.deleteMaterial);
router.post('/:id/confirm-assignment', material_controller_1.confirmMaterialAssignment);
router.post('/:id/index', material_controller_1.indexUserMaterial);
router.get('/:id/download', material_controller_1.downloadMaterial);
exports.default = router;
