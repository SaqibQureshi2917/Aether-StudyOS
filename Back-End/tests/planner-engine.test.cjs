const test = require('node:test');
const assert = require('node:assert/strict');
const { SchedulingEngine } = require('../dist/services/plannerEngine/scheduling.engine.js');
const { PriorityEngine, PRIORITY_WEIGHTS } = require('../dist/services/plannerEngine/priority.engine.js');
const { localDateTimeToUtc } = require('../dist/services/plannerEngine/timezone.util.js');
const { EstimationEngine } = require('../dist/services/plannerEngine/estimation.engine.js');

const date = (value) => new Date(value);

test('schedule sessions stay within availability and never cross the task deadline', () => {
  const result = SchedulingEngine.generateSchedule(
    [{ id: 'task-1', title: 'Essay', remainingHours: 2, priorityScore: 90, deadline: date('2026-10-02T10:30:00.000Z') }],
    [{ id: 'slot-1', startTime: date('2026-10-02T08:00:00.000Z'), endTime: date('2026-10-02T12:00:00.000Z') }],
    date('2026-10-01T00:00:00.000Z'),
  );
  assert.ok(result.sessions.length >= 2);
  assert.ok(result.sessions.every((session) => session.endTime <= date('2026-10-02T10:30:00.000Z')));
  assert.equal(result.scheduledHours, 2);
  assert.equal(result.conflicts.length, 0);
});

test('overlapping availability is merged so the same minutes are not double counted', () => {
  const result = SchedulingEngine.generateSchedule(
    [{ id: 'task-1', title: 'Reading', remainingHours: 3, priorityScore: 50, deadline: date('2026-10-04T23:00:00.000Z') }],
    [
      { id: 'slot-1', startTime: date('2026-10-04T08:00:00.000Z'), endTime: date('2026-10-04T10:00:00.000Z') },
      { id: 'slot-2', startTime: date('2026-10-04T09:00:00.000Z'), endTime: date('2026-10-04T11:00:00.000Z') },
    ],
    date('2026-10-03T00:00:00.000Z'),
  );
  assert.equal(result.availableHours, 3);
  assert.equal(result.scheduledHours, 3);
  for (let index = 1; index < result.sessions.length; index += 1) {
    assert.ok(result.sessions[index - 1].endTime <= result.sessions[index].startTime);
  }
});

test('reports deadline-passed and insufficient-capacity conflicts without scheduling past due', () => {
  const now = date('2026-10-01T12:00:00.000Z');
  const result = SchedulingEngine.generateSchedule(
    [
      { id: 'late', title: 'Past due', remainingHours: 1, priorityScore: 100, deadline: date('2026-10-01T11:59:00.000Z') },
      { id: 'short', title: 'Not enough time', remainingHours: 3, priorityScore: 50, deadline: date('2026-10-02T10:00:00.000Z') },
    ],
    [{ id: 'slot', startTime: date('2026-10-02T08:00:00.000Z'), endTime: date('2026-10-02T09:00:00.000Z') }],
    now,
  );
  assert.deepEqual(result.conflicts.map((item) => item.reason), ['DEADLINE_PASSED', 'INSUFFICIENT_CAPACITY']);
  assert.equal(result.unscheduledHours, 3);
  assert.ok(result.sessions.every((session) => session.endTime <= date('2026-10-02T10:00:00.000Z')));
});

test('priority score is deterministic, normalized, and exposes its configured factors', () => {
  const now = date('2026-10-01T00:00:00.000Z');
  const input = { deadline: date('2026-10-05T00:00:00.000Z'), estimatedHours: 2, difficulty: 'HARD', userPriority: 'HIGH', academicRisk: 75 };
  const result = PriorityEngine.explain(input, now);
  assert.equal(result.score, PriorityEngine.calculatePriority(input, now));
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(Object.values(PRIORITY_WEIGHTS).reduce((sum, value) => sum + value, 0), 1);
  assert.equal(result.factors.academicRisk, 75);
});

test('weekly local study hours convert using the selected timezone and daylight offset', () => {
  assert.equal(localDateTimeToUtc(2026, 9, 29, 18, 0, 'Asia/Karachi').toISOString(), '2026-09-29T13:00:00.000Z');
  assert.equal(localDateTimeToUtc(2026, 1, 15, 18, 0, 'America/New_York').toISOString(), '2026-01-15T23:00:00.000Z');
  assert.equal(localDateTimeToUtc(2026, 7, 15, 18, 0, 'America/New_York').toISOString(), '2026-07-15T22:00:00.000Z');
});

test('historical effort adjustment is based on saved session ratios and remains bounded', () => {
  assert.deepEqual(EstimationEngine.estimateRemaining(10, 2, []), {
    baselineRemainingHours: 8,
    adjustmentMultiplier: 1,
    remainingHours: 8,
  });
  assert.equal(EstimationEngine.estimateRemaining(10, 2, [5, 4, 3]).adjustmentMultiplier, 1.25);
  assert.equal(EstimationEngine.estimateRemaining(10, 2, [0.1, 0.2, 0.3]).adjustmentMultiplier, 0.8);
  assert.equal(EstimationEngine.estimateRemaining(2, 5, [1]).remainingHours, 0);
});
