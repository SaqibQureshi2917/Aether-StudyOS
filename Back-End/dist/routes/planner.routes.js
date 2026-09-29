"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const planner_controller_1 = require("../controllers/planner.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const chat_rate_limit_middleware_1 = require("../middleware/chat-rate-limit.middleware");
const router = (0, express_1.Router)();
router.get('/overview', auth_middleware_1.authenticate, planner_controller_1.getPlannerOverview);
router.get('/availability', auth_middleware_1.authenticate, planner_controller_1.getPlannerAvailability);
router.put('/availability', auth_middleware_1.authenticate, planner_controller_1.replacePlannerAvailability);
router.post('/preview', auth_middleware_1.authenticate, planner_controller_1.previewPlannerSchedule);
router.post('/apply', auth_middleware_1.authenticate, planner_controller_1.applyPlannerSchedule);
router.post('/explain', auth_middleware_1.authenticate, chat_rate_limit_middleware_1.limitChatRequests, planner_controller_1.explainPlannerWorkload);
// Backwards-compatible endpoint: generation now previews and requires explicit confirmation via /apply.
router.post('/generate', auth_middleware_1.authenticate, planner_controller_1.previewPlannerSchedule);
exports.default = router;
