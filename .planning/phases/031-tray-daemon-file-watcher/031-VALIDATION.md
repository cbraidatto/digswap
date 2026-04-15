---
phase: 31
slug: tray-daemon-file-watcher
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + Electron main process tests |
| **Config file** | `apps/desktop/vitest.config.ts` or root vitest config |
| **Quick run command** | `npx vitest run --reporter=verbose apps/desktop/src/main` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose apps/desktop/src/main`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | DAEMON-01 | unit | `grep -q "Tray" apps/desktop/src/main/tray.ts` | ❌ W0 | ⬜ pending |
| 31-01-02 | 01 | 1 | DAEMON-01 | unit | `grep -q "preventDefault" apps/desktop/src/main/window.ts` | ✅ | ⬜ pending |
| 31-02-01 | 02 | 1 | DAEMON-03 | unit | `grep -q "chokidar" apps/desktop/src/main/watcher.ts` | ❌ W0 | ⬜ pending |
| 31-03-01 | 03 | 2 | SCAN-05 | unit | `grep -q "diffScan" apps/desktop/src/main/diff-scan.ts` | ❌ W0 | ⬜ pending |
| 31-04-01 | 04 | 2 | DAEMON-04 | unit | `grep -q "setLoginItemSettings" apps/desktop/src/main/index.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/desktop/src/main/tray.ts` — tray module (created by plan)
- [ ] `apps/desktop/src/main/watcher.ts` — file watcher module (created by plan)
- [ ] `apps/desktop/src/main/diff-scan.ts` — diff scan module (created by plan)

*Existing infrastructure covers test framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tray icon appears in system tray | DAEMON-01 | Requires Windows system tray interaction | 1. Launch app 2. Verify tray icon visible 3. Right-click → see Open/Quit menu |
| Close button minimizes to tray | DAEMON-01 | Requires window close event in live Electron | 1. Click X button 2. Verify window hides 3. Verify tray icon persists |
| File watcher detects new file | DAEMON-03 | Requires filesystem events in live Electron | 1. Set library root 2. Copy audio file into folder 3. Wait 2min debounce 4. Verify scan triggers |
| App starts on Windows boot | DAEMON-04 | Requires Windows login/startup sequence | 1. Enable auto-start in settings 2. Reboot PC 3. Verify app starts in tray |
| Diff scan on startup finds changes | SCAN-05 | Requires app restart with filesystem changes | 1. Close app 2. Add/remove files 3. Relaunch 4. Verify toast shows changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
