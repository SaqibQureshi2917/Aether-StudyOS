"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const onboarding_routes_1 = __importDefault(require("./routes/onboarding.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const course_routes_1 = __importDefault(require("./routes/course.routes"));
const assignment_routes_1 = __importDefault(require("./routes/assignment.routes"));
const material_routes_1 = __importDefault(require("./routes/material.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const planner_routes_1 = __importDefault(require("./routes/planner.routes"));
const session_routes_1 = __importDefault(require("./routes/session.routes"));
const recommendation_routes_1 = __importDefault(require("./routes/recommendation.routes"));
const semester_routes_1 = __importDefault(require("./routes/semester.routes"));
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && env_1.ENV.CORS_ORIGINS.includes(origin) && req.headers['access-control-request-private-network'] === 'true') {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
});
app.use((0, cors_1.default)({ origin: env_1.ENV.CORS_ORIGINS, credentials: true }));
app.use(express_1.default.json());
// Routes Mounting
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/user', user_routes_1.default);
app.use('/api/v1/user', onboarding_routes_1.default);
app.use('/api/v1/dashboard', dashboard_routes_1.default);
app.use('/api/v1/courses', course_routes_1.default);
app.use('/api/v1/semesters', semester_routes_1.default);
app.use('/api/v1/assignments', assignment_routes_1.default);
app.use('/api/v1/materials', material_routes_1.default);
app.use('/api/v1/chat', chat_routes_1.default);
app.use('/api/v1/planner', planner_routes_1.default);
app.use('/api/v1/sessions', session_routes_1.default);
app.use('/api/v1/recommendations', recommendation_routes_1.default);
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Aether Engine Active' });
});
app.use(error_middleware_1.errorHandler);
exports.default = app;
