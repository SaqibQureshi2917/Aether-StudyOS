"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EstimationEngine = void 0;
/** Uses only recorded actual/planned ratios and bounds changes to avoid extreme estimates. */
class EstimationEngine {
    static estimateRemaining(estimatedHours, completedHours, historicalRatios) {
        const safeEstimated = Number.isFinite(estimatedHours) ? Math.max(0, estimatedHours) : 0;
        const safeCompleted = Number.isFinite(completedHours) ? Math.max(0, completedHours) : 0;
        const baselineRemainingHours = Math.max(0, safeEstimated - safeCompleted);
        const ratios = historicalRatios.filter((ratio) => Number.isFinite(ratio) && ratio > 0).slice(0, 5)
            .map((ratio) => Math.min(1.5, Math.max(0.5, ratio)));
        const averageRatio = ratios.length ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : 1;
        const adjustmentMultiplier = ratios.length ? Math.min(1.25, Math.max(0.8, averageRatio)) : 1;
        return {
            baselineRemainingHours,
            adjustmentMultiplier,
            remainingHours: baselineRemainingHours * adjustmentMultiplier,
        };
    }
}
exports.EstimationEngine = EstimationEngine;
