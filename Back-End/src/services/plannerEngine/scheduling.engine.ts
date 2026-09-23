// backend/src/services/planner/scheduling.engine.ts

export interface TaskInput {
  id: string;
  title: string;
  estimatedHours: number;
  priorityScore: number;
  deadline: Date;
}

export interface AvailabilitySlot {
  id: string;
  startTime: Date;
  endTime: Date; 
}

export interface ScheduledSession {
  taskId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  durationHours: number;
}

export class SchedulingEngine {
  /**
   * Deterministically allocates tasks into available slots based on priority scores.
   * Handles task chunking and deadline boundaries strictly without AI hallucinations.
   */
  public static generateSchedule(
    tasks: TaskInput[],
    availabilitySlots: AvailabilitySlot[]
  ): ScheduledSession[] {
    // 1. Sort tasks by priority score descending (highest priority / urgency first)
    const sortedTasks = [...tasks].sort((a, b) => b.priorityScore - a.priorityScore);

    // 2. Sort availability slots chronologically
    const sortedSlots = [...availabilitySlots].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const scheduledSessions: ScheduledSession[] = [];
    
    // Track remaining capacity and pointer for each slot
    const slotTracker = sortedSlots.map(slot => ({
      ...slot,
      remainingMinutes: Math.round(
        (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60)
      ),
      currentPointer: new Date(slot.startTime),
    }));

    for (const task of sortedTasks) {
      let remainingTaskMinutes = Math.round(task.estimatedHours * 60);

      for (const slot of slotTracker) {
        if (remainingTaskMinutes <= 0) break;
        if (slot.remainingMinutes <= 0) continue;

        // Constraint check: Do not schedule after the task deadline
        if (new Date(slot.currentPointer).getTime() > new Date(task.deadline).getTime()) {
          continue; 
        }

        // Calculate how many minutes can fit in this current slot
        const minutesToAllocate = Math.min(remainingTaskMinutes, slot.remainingMinutes);
        
        const sessionStart = new Date(slot.currentPointer);
        const sessionEnd = new Date(sessionStart.getTime() + minutesToAllocate * 60 * 1000);

        scheduledSessions.push({
          taskId: task.id,
          title: task.title,
          startTime: sessionStart,
          endTime: sessionEnd,
          durationHours: minutesToAllocate / 60,
        });

        // Advance slot pointer and reduce remaining slot/task time
        slot.currentPointer = sessionEnd;
        slot.remainingMinutes -= minutesToAllocate;
        remainingTaskMinutes -= minutesToAllocate;
      }

      // Enterprise warning if student didn't provide enough slots for the workload
      if (remainingTaskMinutes > 0) {
        console.warn(`[SchedulingEngine] Warning: Task "${task.title}" could not be fully scheduled. Unallocated: ${remainingTaskMinutes / 60} hours.`);
      }
    }

    return scheduledSessions;
  }
}