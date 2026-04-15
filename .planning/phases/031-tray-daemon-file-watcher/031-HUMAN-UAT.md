---
status: partial
phase: 031-tray-daemon-file-watcher
source: [031-VERIFICATION.md]
started: 2026-04-15T11:25:00Z
updated: 2026-04-15T11:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Tray icon visual appearance
expected: A 16x16 white vinyl record silhouette icon appears in the Windows system tray with tooltip "DigSwap Desktop"
result: [pending]

### 2. Close-to-tray behavior
expected: Click window X button — window disappears but tray icon remains. Double-click tray icon to restore. Right-click tray for Open/Quit menu.
result: [pending]

### 3. Auto-start with Windows
expected: Enable auto-start via IPC, reboot Windows — app starts minimized to tray (no visible window, only tray icon)
result: [pending]

### 4. File watcher real-time detection
expected: Copy a .flac file into watched folder, wait 2+ minutes — incremental scan runs automatically and sync follows
result: [pending]

### 5. Diff scan on cold start
expected: While app is closed, add/remove a .flac file. Launch app — diff scan detects changes and sends desktop:diff-scan-result IPC. If boot-to-tray, native notification shows change summary.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
