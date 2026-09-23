// backend/src/modules/planner/engine/priority.engine.ts

export interface PriorityInput {
  deadline: Date;
  estimatedHours: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | number; // Support both enum or numeric scale 1-5
  userPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | number;
  isOverdue?: boolean;
}

export class PriorityEngine {
  // Weights configuration (configurable for fine-tuning)
  private static readonly WEIGHTS = {
    deadlineUrgency: 0.35,
    effort: 0.20,
    difficulty: 0.15,
    userPriority: 0.20,
    overdueBonus: 0.10,
  };

  /**
   * Calculates a normalized deterministic priority score (0 to 100)
   * Higher score means higher scheduling priority.
   */
  public static calculatePriority(input: PriorityInput): number {
    const now = new Date();
    const timeDiffMs = new Date(input.deadline).getTime() - now.getTime();
    const daysRemaining = Math.max(0, timeDiffMs / (1000 * 60 * 60 * 24));

    // 1. Deadline Urgency Score (Exponential decay as deadline approaches)
    // If deadline is today (0 days), score is 100. If > 30 days, score approaches 0.
    const deadlineScore = Math.max(0, 100 - (daysRemaining / 30) * 100);

    // 2. Effort / Workload Score (Normalized assuming max 20 hours per task)
    const effortScore = Math.min(100, (input.estimatedHours / 20) * 100);

    // 3. Difficulty Score Conversion
    let diffNumeric = 3; // default medium
    if (typeof input.difficulty === 'string') {
      const map: Record<string, number> = { EASY: 1, MEDIUM: 3, HARD: 5 };
      diffNumeric = map[input.difficulty] || 3;
    } else {
      diffNumeric = input.difficulty;
    }
    const difficultyScore = (diffNumeric / 5) * 100;

    // 4. User Priority Score Conversion
    let prioNumeric = 3;
    if (typeof input.userPriority === 'string') {
      const map: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 4, URGENT: 5 };
      prioNumeric = map[input.userPriority] || 2;
    } else {
      prioNumeric = input.userPriority;
    }
    const userPriorityScore = (prioNumeric / 5) * 100;

    // 5. Overdue Status
    const isOverdue = input.isOverdue || daysRemaining === 0;
    const overdueScore = isOverdue ? 100 : 0;

    // Weighted Final Score Calculation
    const finalScore =
      deadlineScore * PriorityEngine.WEIGHTS.deadlineUrgency +
      effortScore * PriorityEngine.WEIGHTS.effort +
      difficultyScore * PriorityEngine.WEIGHTS.difficulty +
      userPriorityScore * PriorityEngine.WEIGHTS.userPriority +
      overdueScore * PriorityEngine.WEIGHTS.overdueBonus;

    // Return rounded score between 0 and 100
    return Math.round(Math.min(100, Math.max(0, finalScore)) * 100) / 100;
  }
}