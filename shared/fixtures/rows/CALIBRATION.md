# 4 Nov replay calibration (Task 14, D6)

Acceptance test: `shared/engine/replay.test.ts` (fixture `concert4Nov()`, plan `REPLAY_PLAN_4NOV` in `shared/plans/replayPlan.ts`).

## Initial run (P1 starting values)

| Figure | Value | Target |
|---|---|---|
| No-action risk level | critical | critical |
| No-action peak APU queue | 366.0 at 1080 min (18:00) | 340–460, at 1050–1110 |
| No-action peak APU wait | 192.6 min | > 120 |
| Plan peak APU wait | 15.9 min (8.2% of no-action) | ≤ 30% of no-action |
| Plan total cost | RM -283.37 (net saving) | ≤ RM 2,000 |
| Plan sessions moved | 413 | 413 |

All targets were met on the initial run.

## Changes from P1 starting values

None. No calibration was needed, so no input was changed.

## Final values (unchanged from P1)

| Input | Value |
|---|---|
| `weeknd-2026-11-04` attendanceDrop | likely 0.35 (low 0.2, high 0.5) |
| dinnerStayShare | likely 0.4 (low 0.25, high 0.6) |
| advisoryCompliance | likely 0.6 (low 0.4, high 0.75) |
| eventLrtModeShare | likely 0.45 (low 0.35, high 0.55) |
| Reconstructed ratio, hour indices 0–4 | 1.15, 1.25, 1.10, 1.10, 1.20 |
| Reconstructed ratio, hour indices 5–9 | 4.5, 5.5, 6.0, 7.0, 8.0 |
| Reconstructed ratio, hour indices 10–17 | 9.5, 10.5, 11.0, 11.0, 10.5, 10.0, 9.5, 9.0 |
| Reconstructed ratio, hour indices 18–19 | 7.0, 4.0 |

(Ratio = `duration_s / static_duration_s`, static 360 s, same in both directions.)

Note: P1's ratios at hour index 9 (8.0, tuning range 4.5–7.0) and hour index 17 (9.0, tuning range ≥ 9.5) were already outside the Task 14 tuning ranges. They were left alone because no tuning was needed.

## Final acceptance figures

Same as the initial run: Critical; peak APU queue 366.0 at 18:00; peak APU wait 192.6 min; plan peak wait 15.9 min; plan cost RM -283.37; 413 sessions moved.

Only replay inputs were tuned (D6); engine formulas and Baseline values are unchanged.
