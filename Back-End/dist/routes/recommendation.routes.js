"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/routes/recommendation.routes.ts
const express_1 = require("express");
const recommendation_controller_1 = require("../controllers/recommendation.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Endpoint to accept a recommendation and trigger deterministic plan update
router.post('/:recommendationId/accept', auth_middleware_1.authenticate, recommendation_controller_1.acceptRecommendation);
router.post('/:recommendationId/dismiss', auth_middleware_1.authenticate, recommendation_controller_1.dismissRecommendation);
exports.default = router;
