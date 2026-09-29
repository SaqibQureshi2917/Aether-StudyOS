"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriorityEngine = exports.PRIORITY_WEIGHTS = void 0;
exports.PRIORITY_WEIGHTS = Object.freeze({
    deadlineUrgency: 0.32,
    remainingEffort: 0.18,
    difficulty: 0.14,
    userPriority: 0.18,
    overdue: 0.10,
    academicRisk: 0.08,
});
function clamp(value, min, max, fallback) {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
class PriorityEngine {
    /**
     * Stable, explainable weights: deadline 32%, remaining effort 18%,
     * difficulty 14%, user/course priority 18%, overdue status 10%,
     * and verified weak-topic risk 8%.
     * Inputs are normalized to 0..100 before applying the configured weights.
     */
    static explain(input, now = new Date()) {
        const daysRemaining = (input.deadline.getTime() - now.getTime()) / 86_400_000;
        const factors = {
            deadlineUrgency: clamp(100 - (Math.max(0, daysRemaining) / 30) * 100, 0, 100, 0),
            remainingEffort: clamp(Math.max(0, input.estimatedHours) / 20 * 100, 0, 100, 0),
            difficulty: 0,
            userPriority: 0,
            overdue: (input.isOverdue ?? daysRemaining < 0) ? 100 : 0,
            academicRisk: clamp(input.academicRisk ?? 0, 0, 100, 0),
        };
        const difficultyMap = { EASY: 1, MEDIUM: 3, HARD: 5 };
        const priorityMap = { LOW: 1, MEDIUM: 2, HIGH: 4, URGENT: 5 };
        const difficulty = typeof input.difficulty === 'string' ? difficultyMap[input.difficulty] ?? 3 : input.difficulty;
        const priority = typeof input.userPriority === 'string' ? priorityMap[input.userPriority] ?? 2 : input.userPriority;
        factors.difficulty = clamp(difficulty, 1, 5, 3) * 20;
        factors.userPriority = clamp(priority, 1, 5, 2) * 20;
        const score = Math.round(Object.entries(exports.PRIORITY_WEIGHTS).reduce((sum, [key, weight]) => (sum + factors[key] * weight), 0) * 100) / 100;
        return { score, factors, weights: exports.PRIORITY_WEIGHTS };
    }
    static calculatePriority(input, now = new Date()) {
        return this.explain(input, now).score;
    }
}
exports.PriorityEngine = PriorityEngine;
