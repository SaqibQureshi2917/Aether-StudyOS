export interface PriorityInput {
  deadline: Date;
  estimatedHours: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | number;
  userPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | number;
  isOverdue?: boolean;
  academicRisk?: number;
}

export const PRIORITY_WEIGHTS = Object.freeze({
  deadlineUrgency: 0.32,
  remainingEffort: 0.18,
  difficulty: 0.14,
  userPriority: 0.18,
  overdue: 0.10,
  academicRisk: 0.08,
});

export interface PriorityBreakdown {
  score: number;
  factors: Record<keyof typeof PRIORITY_WEIGHTS, number>;
  weights: typeof PRIORITY_WEIGHTS;
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export class PriorityEngine {
  /**
   * Stable, explainable weights: deadline 32%, remaining effort 18%,
   * difficulty 14%, user/course priority 18%, overdue status 10%,
   * and verified weak-topic risk 8%.
   * Inputs are normalized to 0..100 before applying the configured weights.
   */
  public static explain(input: PriorityInput, now = new Date()): PriorityBreakdown {
    const daysRemaining = (input.deadline.getTime() - now.getTime()) / 86_400_000;
    const factors: PriorityBreakdown['factors'] = {
      deadlineUrgency: clamp(100 - (Math.max(0, daysRemaining) / 30) * 100, 0, 100, 0),
      remainingEffort: clamp(Math.max(0, input.estimatedHours) / 20 * 100, 0, 100, 0),
      difficulty: 0,
      userPriority: 0,
      overdue: (input.isOverdue ?? daysRemaining < 0) ? 100 : 0,
      academicRisk: clamp(input.academicRisk ?? 0, 0, 100, 0),
    };
    const difficultyMap: Record<string, number> = { EASY: 1, MEDIUM: 3, HARD: 5 };
    const priorityMap: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 4, URGENT: 5 };
    const difficulty = typeof input.difficulty === 'string' ? difficultyMap[input.difficulty] ?? 3 : input.difficulty;
    const priority = typeof input.userPriority === 'string' ? priorityMap[input.userPriority] ?? 2 : input.userPriority;
    factors.difficulty = clamp(difficulty, 1, 5, 3) * 20;
    factors.userPriority = clamp(priority, 1, 5, 2) * 20;
    const score = Math.round(Object.entries(PRIORITY_WEIGHTS).reduce((sum, [key, weight]) => (
      sum + factors[key as keyof typeof PRIORITY_WEIGHTS] * weight
    ), 0) * 100) / 100;
    return { score, factors, weights: PRIORITY_WEIGHTS };
  }

  public static calculatePriority(input: PriorityInput, now = new Date()): number {
    return this.explain(input, now).score;
  }
}
