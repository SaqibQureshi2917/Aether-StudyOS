export interface TaskInput {
  id: string;
  title: string;
  remainingHours: number;
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

export interface ScheduleConflict {
  taskId: string;
  title: string;
  deadline: Date;
  remainingHours: number;
  unscheduledHours: number;
  reason: 'DEADLINE_PASSED' | 'INSUFFICIENT_CAPACITY';
}

export interface ScheduleResult {
  sessions: ScheduledSession[];
  conflicts: ScheduleConflict[];
  availableHours: number;
  scheduledHours: number;
  unscheduledHours: number;
}

const MAX_SESSION_MINUTES = 60;
const roundHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

export class SchedulingEngine {
  /**
   * Deterministic weighted-priority scheduler. Overlapping availability is merged,
   * deadlines cap a session's end time, and unscheduled effort is reported explicitly.
   */
  public static generateSchedule(tasks: TaskInput[], availabilitySlots: AvailabilitySlot[], now = new Date()): ScheduleResult {
    const validSlots = availabilitySlots
      .filter((slot) => Number.isFinite(slot.startTime.getTime()) && Number.isFinite(slot.endTime.getTime()) && slot.endTime > slot.startTime)
      .map((slot) => ({ ...slot, startTime: new Date(Math.max(now.getTime(), slot.startTime.getTime())), endTime: new Date(slot.endTime) }))
      .filter((slot) => slot.endTime > slot.startTime)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const mergedSlots: Array<{ startTime: Date; endTime: Date; currentPointer: Date; remainingMinutes: number }> = [];
    for (const slot of validSlots) {
      const last = mergedSlots[mergedSlots.length - 1];
      if (last && slot.startTime.getTime() <= last.endTime.getTime()) {
        if (slot.endTime > last.endTime) last.endTime = slot.endTime;
        last.remainingMinutes = Math.floor((last.endTime.getTime() - last.currentPointer.getTime()) / 60_000);
      } else {
        mergedSlots.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          currentPointer: new Date(slot.startTime),
          remainingMinutes: Math.floor((slot.endTime.getTime() - slot.startTime.getTime()) / 60_000),
        });
      }
    }

    const sortedTasks = [...tasks]
      .filter((task) => Number.isFinite(task.remainingHours) && task.remainingHours > 0 && Number.isFinite(task.deadline.getTime()))
      .sort((a, b) => b.priorityScore - a.priorityScore || a.deadline.getTime() - b.deadline.getTime() || a.id.localeCompare(b.id));
    const sessions: ScheduledSession[] = [];
    const conflicts: ScheduleConflict[] = [];
    const availableMinutes = mergedSlots.reduce((sum, slot) => sum + slot.remainingMinutes, 0);

    for (const task of sortedTasks) {
      const requiredMinutes = Math.max(1, Math.ceil(task.remainingHours * 60 - 1e-8));
      let remainingMinutes = requiredMinutes;
      if (task.deadline.getTime() <= now.getTime()) {
        conflicts.push({ taskId: task.id, title: task.title, deadline: task.deadline, remainingHours: roundHours(requiredMinutes), unscheduledHours: roundHours(requiredMinutes), reason: 'DEADLINE_PASSED' });
        continue;
      }

      for (const slot of mergedSlots) {
        while (remainingMinutes > 0 && slot.remainingMinutes > 0 && slot.currentPointer < task.deadline) {
          const minutesUntilDeadline = Math.floor((task.deadline.getTime() - slot.currentPointer.getTime()) / 60_000);
          const minutesToAllocate = Math.min(remainingMinutes, slot.remainingMinutes, minutesUntilDeadline, MAX_SESSION_MINUTES);
          if (minutesToAllocate <= 0) break;
          const startTime = new Date(slot.currentPointer);
          const endTime = new Date(startTime.getTime() + minutesToAllocate * 60_000);
          sessions.push({ taskId: task.id, title: task.title, startTime, endTime, durationHours: minutesToAllocate / 60 });
          slot.currentPointer = endTime;
          slot.remainingMinutes -= minutesToAllocate;
          remainingMinutes -= minutesToAllocate;
        }
        if (remainingMinutes <= 0) break;
      }

      if (remainingMinutes > 0) {
        conflicts.push({
          taskId: task.id,
          title: task.title,
          deadline: task.deadline,
          remainingHours: roundHours(requiredMinutes),
          unscheduledHours: roundHours(remainingMinutes),
          reason: 'INSUFFICIENT_CAPACITY',
        });
      }
    }

    const scheduledMinutes = sessions.reduce((sum, session) => sum + session.durationHours * 60, 0);
    return {
      sessions,
      conflicts,
      availableHours: roundHours(availableMinutes),
      scheduledHours: roundHours(scheduledMinutes),
      unscheduledHours: roundHours(conflicts.reduce((sum, conflict) => sum + conflict.unscheduledHours * 60, 0)),
    };
  }
}
