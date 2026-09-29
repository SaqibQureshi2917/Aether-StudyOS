"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public Routes
router.post('/register', auth_controller_1.register);
router.post('/login', auth_controller_1.login);
router.post('/password-reset/request', auth_controller_1.requestPasswordReset);
router.post('/password-reset/confirm', auth_controller_1.resetPassword);
// Protected Routes
router.get('/me', auth_middleware_1.authenticate, auth_controller_1.getMe);
router.post('/logout', auth_middleware_1.authenticate, auth_controller_1.logout);
exports.default = router;
