# Test Coverage Status — v3.0

**Last updated**: 2026-05-24 (post-T077, week-3 ratchet)
**Audit frequency**: weekly during v3.0 implementation; one row per coverage-ratchet event.

## Current gate (jest.config.js → coverageThreshold.global)

| Metric | Threshold | Last measured | Slack |
| ------ | --------- | ------------- | ----- |
| Lines | **30 %** | 58.22 %\* | +28 pts |
| Statements | 30 % | 57.34 % | +27 pts |
| Functions | 25 % | 50.45 % | +25 pts |
| Branches | 18 % | 45.75 % | +27 pts |

\*\* Last measured numbers are from T046's unit-only run. Integration tests
added in Phases 9 (Rollback), 10 (Notifications/Auth/Audit/AutoRecovery)
expand the denominator; re-run once Phase 13 lands.

\* Measured only against files actually loaded by the current test suite (unit
tests). When integration tests come online (Phase 8+), the denominator
expands; current slack will compress accordingly. Plan for the slack to
shrink by ≥ 20 pts once notification + workspace + template features add
their own untested src/ surface.

## Ratchet schedule (research D-10)

| Week | Date target | Gate target | Tasks | Status |
| ---- | ----------- | ----------- | ----- | ------ |
| 1 | 2026-05-23 | 0 % (stub) | T008 | ✅ done |
| 2 | 2026-05-30 | 20 % | T046 | ✅ done |
| 3 | 2026-06-06 | **30 %** | T077 | ✅ done (this audit) |
| 4 | 2026-06-13 | 40 % / 30 % client (GA gate) | T094 | ⏳ pending |

## Files / areas currently uncovered (must improve for next ratchet)

### Untouched src directories (need tests added in T075 / T077 / T092 / T093)

| Area | Coverage est. | Coming in |
| ---- | ------------- | --------- |
| `Services/DeploymentService.ts` | < 5 % (only via import) | T093 integration |
| `Services/NotificationService.ts` + dispatchers | n/a (Phase 8 not built yet) | T075 |
| `Services/AuditLogService.ts` | 0 % | T078 |
| `Services/AutoRecovery.ts` | 0 % | T078 |
| `Services/PipelineService.ts` | 0 % | T093 (indirect, via deployment run) |
| `Controllers/*.ts` | low | T092 (Projects), T093 (Deployments), T077 (Auth) |
| `Routes/*.ts` | n/a until integration covers them | T092+T093 |
| `Migrations/*.ts` | excluded by config | n/a |
| `Models/*.ts` | low | covered transitively via integration |

### Hot paths with existing tests but partial coverage

| File | Lines covered (approx) | Notes |
| ---- | ---------------------- | ----- |
| `Utils/EncryptionHelper.ts` | 100 % | T041 |
| `Utils/PasswordHelper.ts` | 100 % | T041 |
| `Utils/LogFormatter.ts` | ~90 % | T042 — `Format*` color path partly exercised |
| `Utils/SshKeyGenerator.ts` | ~75 % | T042 (generation tests skip when ssh-keygen probe fails) |
| `Services/QueueService.ts` | ~80 % | T043 (retry test opt-in via RUN_SLOW_QUEUE_TEST=1) |
| `Services/EnvironmentVariableService.ts` | ~80 % | covered via T044 integration |

## Operator notes / pre-existing tech debt blocking gate accuracy

| Issue | Impact | Owner |
| ----- | ------ | ----- |
| `Utils/SshKeyGenerator.CheckSshKeygenAvailable` uses invalid `ssh-keygen -V` flag → always returns false → key-gen tests auto-skip even when ssh-keygen IS on PATH | Generation tests never execute on most machines; coverage on gen paths stays at ~0 % | Pre-existing v2.1 bug. Fix would be 1-line (use `-y` or `which`). Out of v3.0 scope unless promoted. |
| ESLint v9 needs `eslint.config.js` flat config — `npm run lint` fails silently with exit 0 today | CI lint step is no-op | Pre-existing v2.1 bug, separate task. |
| `MigrationRunner.ts` imports `008_...` twice (for slots 007 + 008) — migration 007 effectively never runs | Pre-existing data-shape risk | Pre-existing v2.1 bug. |

## What an audit should check next week (before T077)

1. Run `npx jest --coverage --forceExit` against the FULL suite (with Redis + DB up). Capture the global Lines % from `coverage/coverage-summary.json`.
2. Confirm new tests written in Phase 8 (T075 + T076) lift the global number ≥ 30 %.
3. If slack < +5 pts, identify lowest-coverage file via `coverage/lcov-report/index.html` and write one targeted test per gap.
4. Bump `coverageThreshold.global.lines` to 30 (T077) only AFTER step 2 passes.
