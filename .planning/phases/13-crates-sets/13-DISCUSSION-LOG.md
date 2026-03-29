# Phase 13: Crates & Sets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 13-crates-sets
**Areas discussed:** Crate workspace location, Add-to-crate flow, Drag-to-reorder approach, Crate item lifecycle, Set creation flow, Crate privacy/sharing, Crate metadata

---

## Crate Workspace Location

| Option | Description | Selected |
|--------|-------------|----------|
| /crates route + nav | New dedicated route. 5th tab in bottom nav OR link from profile. Phase 10 CONTEXT already referenced /u/[username]/crate/[id] | ✓ |
| Tab inside /perfil | Crates as a tab on own-profile page alongside Collection, Wantlist | |
| Workspace in /feed | Crates panel accessible from SIGNAL_BOARD feed page as a side panel | |

**User's choice:** `/crates` route

**Follow-up — nav placement:**

| Option | Description | Selected |
|--------|-------------|----------|
| 5th tab in bottom nav | CRATES becomes a primary tab. Requires updating AppShell. | |
| Link from /perfil (Recommended) | No new nav tab. Own profile gets [MY_CRATES →] link. Keeps nav at 4 tabs. | ✓ |

**Notes:** Crates are personal tools, not a social destination — linking from profile keeps the nav clean.

---

## Add-to-Crate Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Popover with crate list (Recommended) | @base-ui/react Popover listing existing crates + '+ New crate' option | ✓ |
| Dialog with create-new | Modal with checkboxes + inline create | |
| One-tap to active crate | Single button adds to most recently opened crate. Toast with undo. | |

**User's choice:** Popover with crate list

**Follow-up — empty state:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline create in popover (Recommended) | Popover opens with name input + [CREATE + ADD] | ✓ |
| Redirect to /crates | Toast with link to create crate first | |

**Notes:** Creating and adding in one step removes friction for first-time use.

---

## Drag-to-Reorder Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Install @dnd-kit/core (Recommended) | ~11KB, React 19 compatible, accessibility-ready. Adds 1 dependency. | ✓ |
| HTML5 native drag API | No install. Less polished, no touch support. | |
| Up/down arrow buttons | No drag. [^] [v] buttons. Simplest, zero dependencies. | |

**User's choice:** Install `@dnd-kit/core`

**Notes:** No DnD library currently in project. @dnd-kit is the current React standard.

---

## Crate Item Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Tag as found, stays in crate (Recommended) | [FOUND] status tag. Item stays visible for session history. | ✓ |
| Remove from crate | Item deleted after moving. Cleaner but loses session record. | |
| User chooses on move | Confirmation dialog: keep or remove. | |

**User's choice:** Tag as `[FOUND]`, stays in crate

**Notes:** Diggers want to see what they found at a session — removing loses that context.

---

## Set Creation Flow

**Source of tracks:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inside crate detail, tracks from crate items (Recommended) | Set builder inline on /crates/[id]. Tracks picked from crate's items. | ✓ |
| Separate /sets route, any release as track | Sets are standalone. Any release can be a track. | |
| Set as a crate variant | Marking a crate as 'played' converts it to a set. | |

**User's choice:** Inside crate detail, tracks from crate items

**Builder UX:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline panel on crate page (Recommended) | [+ NEW SET] expands inline panel. No navigation. | ✓ |
| Full-page set editor | Navigates to /crates/[id]/sets/new. Full-screen editor. | |

**Notes:** Inline panel keeps the workflow on one page. Less context switching.

---

## Crate Privacy / Sharing

| Option | Description | Selected |
|--------|-------------|----------|
| Private only in this phase (Recommended) | Crates are personal workspace only. Crate Drop Link deferred. | ✓ |
| Shareable link in this phase | Public toggle + /u/[username]/crate/[id] route in this phase. | |

**User's choice:** Private only

**Notes:** Phase 10 CONTEXT already named the public URL pattern — deferred there too. Simplifies RLS.

---

## Crate Metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Name only (Recommended) | Name + createdAt. Minimal, covers CRATE-01. | |
| Name + description | Name + optional free-text description. | |
| Name + date + type | Structured: session date (defaults today) + type enum | ✓ |

**User's choice:** Name + date + type

**Follow-up — type options:**

| Option | Description | Selected |
|--------|-------------|----------|
| Digging trip / Event prep / Wish list / Other (Recommended) | Four fixed enum values | ✓ |
| Free text label | Custom label, no enum constraint | |
| Claude's discretion | Claude picks type options | |

**Notes:** Enum: `digging_trip`, `event_prep`, `wish_list`, `other`. Session date defaults to today.

---

## Claude's Discretion

- Exact SQL for crate items ordering (active first, found last)
- Whether set tracks store release metadata snapshot or just FK
- Pagination vs all-items display on crate detail
- Ghost Protocol visual treatment for [FOUND] badge and session_type chip
- Whether @dnd-kit/sortable is needed in addition to @dnd-kit/core

## Deferred Ideas

- Crate Drop Link / public shareable crates — future phase
- Crate activity in feed — future phase
- Collaborative crates — future phase
- Crate / set export — out of scope v1
