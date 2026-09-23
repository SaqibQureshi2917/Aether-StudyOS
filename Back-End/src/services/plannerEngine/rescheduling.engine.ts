

export interface UnfinishedTaskInput {
  taskId: string;
  title: string;
  remainingHours: number;
  deadline: Date;
}

export interface AvailableSlotInput {
  id: string;
  startTime: Date;
  endTime: Date;
}

export interface RescheduledSession {
  taskId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  durationHours: number;
}

export class ReschedulingEngine {
  /**
   * Recalculates and redistributes remaining workload from missed or partial sessions
   * into future available slots deterministically, respecting deadlines and avoiding overload.
   */
  public static redistributeWorkload(
    unfinishedTasks: UnfinishedTaskInput[],
    availableSlots: AvailableSlotInput[]
  ): RescheduledSession[] {
    const rescheduledSessions: RescheduledSession[] = [];
    
    // Sort slots chronologically
    const slotTracker = [...availableSlots]
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map(slot => ({
        ...slot,
        remainingMinutes: Math.round(
          (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60)
        ),
        currentPointer: new Date(slot.startTime),
      }));

    for (const task of unfinishedTasks) {
      let remainingMinutes = Math.round(task.remainingHours * 60);

      for (const slot of slotTracker) {
        if (remainingMinutes <= 0) break;
        if (slot.remainingMinutes <= 0) continue;

        // Never schedule past the task deadline
        if (new Date(slot.currentPointer).getTime() > new Date(task.deadline).getTime()) {
          continue;
        }

        const minutesToAllocate = Math.min(remainingMinutes, slot.remainingMinutes);
        const sessionStart = new Date(slot.currentPointer);
        const sessionEnd = new Date(sessionStart.getTime() + minutesToAllocate * 60 * 1000);

        rescheduledSessions.push({
          taskId: task.taskId,
          title: task.title,
          startTime: sessionStart,
          endTime: sessionEnd,
          durationHours: minutesToAllocate / 60,
        });

        slot.currentPointer = sessionEnd;
        slot.remainingMinutes -= minutesToAllocate;
        remainingMinutes -= minutesToAllocate;
      }

      if (remainingMinutes > 0) {
        console.warn(`[ReschedulingEngine] Critical Warning: Could not fully recover task "${task.title}". Unallocated: ${remainingMinutes / 60} hours before deadline.`);
      }
    }

    return rescheduledSessions;
  }
}