# Phase 32: AI Metadata Enrichment - Research

**Researched:** 2026-04-15
**Domain:** Gemini Flash API integration for music metadata inference in Electron desktop app
**Confidence:** HIGH

## Summary

Phase 32 adds AI-powered metadata enrichment to the desktop app's local library. When a user clicks "Enrich metadata", tracks with null metadata fields are sent to Google's Gemini Flash API, which infers artist, album, title, year, and track number from available clues (filename, folder path, partial tags). Results are stored with a new 'ai' confidence level, and per-field userEdited flags protect manual corrections from subsequent re-inference.

The implementation is entirely within the Electron main process (Gemini API calls) and renderer (UI for button, progress, AI badges, inline editing). The `@google/genai` SDK (v1.50.1) provides structured JSON output via `responseJsonSchema`, allowing typed responses constrained to a schema. Gemini 2.5 Flash is the target model -- 2.0 Flash shuts down June 1, 2026. The free tier allows 10 RPM / 500 RPD, which is sufficient for a local library enrichment workflow.

**Primary recommendation:** Use `@google/genai` with `gemini-2.5-flash`, batch 5-10 tracks per API call to minimize request count, use Zod schema for structured output, store API key via existing `safeStorage` vault pattern, and add per-field `*UserEdited` INTEGER columns to the SQLite tracks table.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Trigger Strategy -- On-Demand Only. Inference runs ONLY when user clicks "Enrich metadata" button. NOT automatic after scan.
- D-02: Poorly-Tagged Threshold -- Any Field Null. A track qualifies for AI inference if ANY of these fields is null: artist, album, title, year.
- D-03: Confidence Model -- Add 'ai' as Third Level. MetadataConfidence expands from 'high' | 'low' to 'high' | 'low' | 'ai'. AI confidence is ABOVE 'low' (folder inference) but BELOW 'high' (tags).
- D-04: User Correction Protection -- Per-Field userEdited Flags. Boolean columns: artistUserEdited, albumUserEdited, titleUserEdited, yearUserEdited, trackUserEdited. AI re-inference SKIPS any field where *UserEdited = true. Manual edit also sets confidence to 'high'.
- D-05: UX -- Inline Editing with AI Badge. Sparkle icon on AI-inferred fields, click to edit inline. After edit, badge disappears, userEdited=true, confidence='high'. No separate review screen.

### Claude's Discretion
- Gemini Flash model version and API configuration (temperature, prompt design)
- Batch size for inference requests (how many tracks per API call)
- Progress UI pattern (progress bar vs inline status per track)
- Whether to send filename/folder path as additional context to Gemini
- Rate limiting / retry strategy for Gemini API calls
- Inline edit component implementation (contenteditable, input, popover)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | App sends poorly-tagged files to Gemini Flash API to infer artist, album, and track information from available clues (filename, folder path, partial tags) | @google/genai SDK with gemini-2.5-flash, structured output via responseJsonSchema, batch 5-10 tracks per request |
| AI-02 | AI-inferred metadata includes a confidence score -- low confidence items are flagged for user review | New 'ai' confidence level in MetadataConfidence type, existing InferredCell component extended for 'ai' rendering with sparkle badge |
| AI-03 | User's manual corrections are preserved and never overwritten by subsequent AI re-inference | Per-field *UserEdited boolean columns in SQLite tracks table, enrichment service checks flags before overwriting |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @google/genai | 1.50.1 | Gemini API SDK | Official Google Gen AI SDK for JavaScript/TypeScript. Replaces deprecated @google/generative-ai (EOL Aug 2025). Supports structured output, streaming, and auto-env-var API key detection. |
| zod | 4.3.6 | Schema definition | Already used in project (trade-domain, web app). Zod 4 has native z.toJSONSchema() for Gemini's responseJsonSchema -- no need for deprecated zod-to-json-schema package. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-sqlite3 | 12.9.0 (existing) | SQLite database | Already in desktop deps. Schema migration for new columns. |
| electron | 41.1.0 (existing) | Desktop runtime | safeStorage for API key encryption. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @google/genai | Vercel AI SDK (@ai-sdk/google) | Adds unnecessary abstraction layer. Direct SDK is simpler for a single-provider use case. |
| gemini-2.5-flash | gemini-2.5-flash-lite | Lite is cheaper (0.10/M input vs higher) but less capable at inferring metadata from sparse clues. Flash is the right balance. |
| gemini-2.5-flash | gemini-3-flash-preview | Preview model -- not stable. 2.5-flash is the recommended stable model as of April 2026. |
| Zod 4 toJSONSchema | zod-to-json-schema package | zod-to-json-schema is unmaintained since Zod 4 added native support. Use Zod 4's built-in z.toJSONSchema(). |

**Installation (in apps/desktop):**
```bash
cd apps/desktop && pnpm add @google/genai zod
```

**Version verification:**
- @google/genai: 1.50.1 (verified via `npm view @google/genai version`, April 2026)
- zod: 4.3.6 (verified, already in project workspace)

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/main/library/
  db.ts                  # Schema migration: add *UserEdited columns + ALTER TABLE
  metadata-parser.ts     # No changes needed
  folder-inference.ts    # No changes needed
  ai-enrichment.ts       # NEW: Gemini API client, batch inference, prompt
  scanner.ts             # No changes needed
  library-ipc.ts         # Add enrich-metadata + update-track-metadata handlers

apps/desktop/src/shared/
  ipc-types.ts           # RESTORE library types (regression), add 'ai' to MetadataConfidence,
                         #   add EnrichProgressEvent, EnrichResult, new IPC methods,
                         #   add *UserEdited fields to LibraryTrack

apps/desktop/src/renderer/src/
  LibraryScreen.tsx      # Add "Enrich metadata" button, enrichment progress state
  LibraryListView.tsx    # Extend InferredCell for 'ai' confidence (sparkle badge), inline editing
  LibraryAlbumView.tsx   # Extend confidence rendering for 'ai', inline editing
```

### Pattern 1: Gemini Structured Output with Zod Schema
**What:** Define a Zod schema for the expected AI response, convert it to JSON schema, and pass it to Gemini's responseJsonSchema config.
**When to use:** Every AI inference call.
**Example:**
```typescript
// Source: https://ai.google.dev/gemini-api/docs/structured-output
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const trackInferenceSchema = z.object({
  tracks: z.array(z.object({
    index: z.number().describe("The index of the track in the input array"),
    artist: z.string().nullable().describe("Inferred artist name, null if unknown"),
    album: z.string().nullable().describe("Inferred album name, null if unknown"),
    title: z.string().nullable().describe("Inferred track title, null if unknown"),
    year: z.number().nullable().describe("Inferred release year, null if unknown"),
    trackNumber: z.number().nullable().describe("Inferred track number, null if unknown"),
  })),
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: z.toJSONSchema(trackInferenceSchema),
    temperature: 0.1,  // Low temperature for factual inference
  },
});

const parsed = trackInferenceSchema.parse(JSON.parse(response.text));
```

### Pattern 2: Batch Tracks in Single Prompt
**What:** Send multiple tracks (5-10) in a single API call to minimize request count and stay within rate limits.
**When to use:** During enrichment batch processing.
**Example:**
```typescript
function buildPrompt(tracks: QualifyingTrack[]): string {
  const trackList = tracks.map((t, i) => {
    const parts: string[] = [`Track ${i}:`];
    if (t.filePath) parts.push(`  File path: ${t.relativePath}`);
    if (t.artist) parts.push(`  Known artist: ${t.artist}`);
    if (t.album) parts.push(`  Known album: ${t.album}`);
    if (t.title) parts.push(`  Known title: ${t.title}`);
    if (t.year) parts.push(`  Known year: ${t.year}`);
    return parts.join("\n");
  }).join("\n\n");

  return `You are a music metadata expert. For each track below, infer the missing metadata fields (artist, album, title, year, track number) from the available clues: file path, folder structure, and any existing partial tags.

Rules:
- Return null for any field you cannot confidently infer
- Do NOT guess randomly -- only infer when the clues strongly suggest the answer
- File paths follow common patterns like "Artist/Album (Year)/NN - Title.ext"
- Prefer well-known artist/album matches over obscure guesses

${trackList}`;
}
```

### Pattern 3: Per-Field UserEdited Protection
**What:** Before writing AI results to a track, check each *UserEdited flag and skip fields the user has manually corrected.
**When to use:** When persisting AI inference results back to SQLite.
**Example:**
```typescript
function applyAiResults(
  existing: TrackRow,
  aiResult: AiTrackInference,
): Partial<TrackRow> {
  const updates: Partial<TrackRow> = {};

  if (!existing.artistUserEdited && aiResult.artist !== null) {
    updates.artist = aiResult.artist;
    updates.artistConfidence = "ai";
  }
  if (!existing.albumUserEdited && aiResult.album !== null) {
    updates.album = aiResult.album;
    updates.albumConfidence = "ai";
  }
  // ... same for title, year, trackNumber

  return updates;
}
```

### Pattern 4: API Key via safeStorage Vault
**What:** Store the Gemini API key in the existing safeStorage vault (same pattern as auth tokens).
**When to use:** API key input/storage at settings time, retrieval at inference time.
**Example:**
```typescript
// Store (in settings handler)
await sessionStore.setVaultItem("gemini_api_key", apiKey);

// Retrieve (in enrichment service)
const apiKey = await sessionStore.getVaultItem("gemini_api_key");
if (!apiKey) throw new Error("Gemini API key not configured");

const ai = new GoogleGenAI({ apiKey });
```

### Pattern 5: IPC Handler Registration (Established)
**What:** Follow the existing `ipcMain.handle` pattern from library-ipc.ts for new enrichment channels.
**When to use:** For `desktop:enrich-metadata` and `desktop:update-track-metadata` handlers.
**Example:**
```typescript
// In library-ipc.ts registerLibraryIpc()
ipcMain.handle("desktop:enrich-metadata", async (): Promise<EnrichResult> => {
  const db = getLibraryDb();
  const qualifying = getQualifyingTracks(db);
  return enrichTracks(db, qualifying, (progress) => {
    sendToMainWindow("desktop:enrich-progress", progress);
  });
});
```

### Anti-Patterns to Avoid
- **One API call per track:** At 10 RPM free tier, a 200-track library would take 20+ minutes. Batch 5-10 tracks per call.
- **Automatic inference on scan:** Violates D-01. User must explicitly trigger enrichment.
- **Overwriting userEdited fields:** Violates D-04. Always check *UserEdited flags before writing AI results.
- **Storing API key in electron-store unencrypted:** Use safeStorage vault, not plain-text electron-store. The session-store.ts vault pattern is already established.
- **Using @google/generative-ai (old SDK):** Deprecated, EOL August 2025. Use @google/genai.
- **Using gemini-2.0-flash:** Shuts down June 1, 2026. Use gemini-2.5-flash.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured AI output parsing | Custom JSON extraction from free-text | @google/genai responseJsonSchema + Zod | Gemini guarantees valid JSON matching your schema. No regex or string parsing needed. |
| API key encryption | Custom encryption | Electron safeStorage via existing session-store vault | OS-level keychain (macOS Keychain, Windows DPAPI). Already proven in the codebase. |
| JSON Schema generation | Manual JSON Schema objects | Zod 4 z.toJSONSchema() | Type-safe, auto-generated, stays in sync with TypeScript types. |
| Retry/backoff logic | Custom sleep loops | Simple retry with exponential backoff (3 retries, 1s/2s/4s) | Gemini returns 429 on rate limit. A simple utility function is fine -- no library needed for 3 retries. |

**Key insight:** The @google/genai SDK with structured output eliminates the hardest part of LLM integration (parsing unreliable free-text responses). The structured output guarantee means the only failure modes are: API key invalid, rate limit hit, or model returns null for a field (which is correct behavior for low-confidence inference).

## Common Pitfalls

### Pitfall 1: ipc-types.ts Regression -- Missing Library Types
**What goes wrong:** Phase 31 removed library types (MetadataConfidence, LibraryTrack, ScanProgressEvent, ScanResult, DesktopBridgeLibrary, SyncResult, SyncProgress) from ipc-types.ts. The desktop app currently has 30+ TypeScript errors.
**Why it happens:** Phase 31 refactored ipc-types.ts for tray/watcher features and accidentally deleted the library type block.
**How to avoid:** Phase 32 MUST restore these types as a prerequisite task (Wave 0). Verify with `tsc --noEmit` before and after.
**Warning signs:** TypeScript compilation errors referencing missing exports from ipc-types.ts.

### Pitfall 2: Gemini Free Tier Rate Limits
**What goes wrong:** 10 RPM / 500 RPD on free tier. A large library (500+ tracks with gaps) could exhaust daily quota quickly.
**Why it happens:** Sending one track per request instead of batching.
**How to avoid:** Batch 5-10 tracks per API call. A 500-track library becomes 50-100 requests, well within 500 RPD. Add a 6-second delay between batches to stay within 10 RPM.
**Warning signs:** 429 status codes from Gemini API.

### Pitfall 3: SQLite Schema Migration Without Transaction
**What goes wrong:** ALTER TABLE to add new columns can fail mid-way, leaving the database in an inconsistent state.
**Why it happens:** Not wrapping multiple ALTER TABLE statements in a transaction.
**How to avoid:** Use `database.transaction()` for all schema changes. Add columns one at a time within a single transaction. Use `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (SQLite 3.35+ supports this via `ALTER TABLE ... ADD COLUMN`; better-sqlite3 uses SQLite 3.45+).
**Warning signs:** Database errors after partial schema migration.

### Pitfall 4: Zod 4 toJSONSchema API Differences
**What goes wrong:** Using the old `zodToJsonSchema()` function from the deprecated `zod-to-json-schema` package instead of Zod 4's native `z.toJSONSchema()`.
**Why it happens:** Most online examples and training data reference the old package.
**How to avoid:** Use `import { z } from "zod"` and then `z.toJSONSchema(schema)`. This is a static method on the `z` namespace in Zod 4.
**Warning signs:** Import errors for `zod-to-json-schema`.

### Pitfall 5: Temperature Too High for Metadata Inference
**What goes wrong:** High temperature (default ~1.0) causes hallucinated metadata -- fake artist names, wrong years.
**Why it happens:** Temperature controls randomness. Metadata inference is a factual extraction task, not creative generation.
**How to avoid:** Set `temperature: 0.1` or `0.0` in the Gemini config. This makes the model deterministic and factual.
**Warning signs:** AI returns plausible-sounding but incorrect metadata.

### Pitfall 6: Not Sending Folder Path as Context
**What goes wrong:** Gemini only sees partial tags (which are already in the DB) and has no additional clues to work with.
**Why it happens:** Forgetting that the file path and folder structure are the richest source of metadata clues.
**How to avoid:** Always include the relative file path in the prompt. The folder-inference.ts patterns (Artist/Album/Track) are common in real music libraries and give Gemini strong structural hints.
**Warning signs:** AI returns null for fields that could be inferred from the folder structure.

## Code Examples

### Gemini Client Initialization (Main Process)
```typescript
// Source: https://ai.google.dev/gemini-api/docs/quickstart
// apps/desktop/src/main/library/ai-enrichment.ts

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { TrackRow } from "./db";

const MODEL = "gemini-2.5-flash";
const BATCH_SIZE = 8;
const INTER_BATCH_DELAY_MS = 6500; // Stay within 10 RPM

const trackInferenceSchema = z.object({
  tracks: z.array(z.object({
    index: z.number(),
    artist: z.string().nullable(),
    album: z.string().nullable(),
    title: z.string().nullable(),
    year: z.number().nullable(),
    trackNumber: z.number().nullable(),
  })),
});

export async function enrichTracks(
  db: Database.Database,
  tracks: QualifyingTrack[],
  apiKey: string,
  onProgress: (event: EnrichProgressEvent) => void,
): Promise<EnrichResult> {
  const ai = new GoogleGenAI({ apiKey });
  let enriched = 0;
  const errors: string[] = [];

  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE);
    try {
      const prompt = buildPrompt(batch);
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(trackInferenceSchema),
          temperature: 0.1,
        },
      });

      const parsed = trackInferenceSchema.parse(JSON.parse(response.text));
      // Apply results respecting userEdited flags
      applyBatchResults(db, batch, parsed.tracks);
      enriched += batch.length;
    } catch (err) {
      errors.push(`Batch ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }

    onProgress({
      total: tracks.length,
      processed: Math.min(i + BATCH_SIZE, tracks.length),
      enriched,
      errorCount: errors.length,
    });

    // Rate limit delay between batches
    if (i + BATCH_SIZE < tracks.length) {
      await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY_MS));
    }
  }

  return { total: tracks.length, enriched, errors };
}
```

### SQLite Schema Migration
```typescript
// In db.ts initSchema() -- add after existing CREATE TABLE
function migrateSchema(database: Database.Database): void {
  // Phase 32: Add userEdited flags for AI metadata enrichment
  const columns = [
    "artistUserEdited INTEGER NOT NULL DEFAULT 0",
    "albumUserEdited INTEGER NOT NULL DEFAULT 0",
    "titleUserEdited INTEGER NOT NULL DEFAULT 0",
    "yearUserEdited INTEGER NOT NULL DEFAULT 0",
    "trackUserEdited INTEGER NOT NULL DEFAULT 0",
  ];

  for (const col of columns) {
    const colName = col.split(" ")[0];
    // SQLite: ALTER TABLE ADD COLUMN is idempotent if column already exists -- but
    // better-sqlite3 throws if column exists. Check PRAGMA table_info first.
    const existing = database.prepare(
      "SELECT name FROM pragma_table_info('tracks') WHERE name = ?"
    ).get(colName);
    if (!existing) {
      database.exec(`ALTER TABLE tracks ADD COLUMN ${col}`);
    }
  }
}
```

### InferredCell Extended for 'ai' Confidence
```typescript
// In LibraryListView.tsx
function InferredCell({
  value,
  confidence,
  className = "",
  onEdit,
}: {
  value: string | null;
  confidence: MetadataConfidence;
  className?: string;
  onEdit?: (newValue: string) => void;
}) {
  if (!value) return <span className={`text-[#4a4035] ${className}`}>--</span>;

  if (confidence === "ai") {
    return (
      <span
        className={`text-[#c8914a] ${className} cursor-pointer group`}
        title="Inferido por IA -- clique para editar"
        onClick={() => onEdit?.(value)}
      >
        {/* Sparkle icon */}
        <svg className="inline w-3 h-3 mr-1 opacity-60" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" />
        </svg>
        {value}
      </span>
    );
  }

  if (confidence === "low") {
    return (
      <span
        className={`text-[#8b7355] italic ${className}`}
        title="Inferido do caminho do arquivo"
      >
        {value}
      </span>
    );
  }

  return <span className={className}>{value}</span>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @google/generative-ai | @google/genai | Aug 2025 EOL | Must use new SDK. Different API surface (ai.models.generateContent vs model.generateContent). |
| gemini-2.0-flash | gemini-2.5-flash | June 2026 shutdown | Must use 2.5-flash. Better quality, same free tier. |
| zod-to-json-schema | Zod 4 z.toJSONSchema() | Zod 4 release (2025) | No external package needed. Built into Zod 4. |

**Deprecated/outdated:**
- @google/generative-ai: Support ends Aug 31, 2025. Replaced by @google/genai.
- gemini-2.0-flash: Shuts down June 1, 2026. Use gemini-2.5-flash.
- zod-to-json-schema: Unmaintained since Zod 4 added native JSON Schema support.

## Open Questions

1. **Zod 4 toJSONSchema exact API in @google/genai context**
   - What we know: Zod 4 has `z.toJSONSchema()` as a static method. The @google/genai SDK expects a JSON Schema object in `responseJsonSchema`.
   - What's unclear: Whether Zod 4's output format is directly compatible with Gemini's responseJsonSchema without any transformation.
   - Recommendation: Test during implementation. If format mismatch, a thin adapter is trivial.

2. **API Key UX -- when to prompt user**
   - What we know: API key stored in safeStorage vault. No Gemini key exists currently.
   - What's unclear: Should the "Enrich metadata" button prompt for API key if not configured, or should there be a Settings screen entry?
   - Recommendation: Check for key when button is clicked. If missing, show inline prompt to enter key. Also add an entry in SettingsScreen for managing the key. The inline-prompt-on-first-use pattern is simpler and more discoverable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Electron main process | Yes | Bundled with Electron 41 | -- |
| better-sqlite3 | Database schema migration | Yes | 12.9.0 | -- |
| electron safeStorage | API key encryption | Yes | Electron 41 | -- |
| Gemini API (external) | AI inference | Requires API key | gemini-2.5-flash | Graceful degradation: button disabled without key |

**Missing dependencies with no fallback:**
- None that block code development. Gemini API key is a runtime requirement, not a build dependency.

**Missing dependencies with fallback:**
- @google/genai and zod need to be installed in the desktop package. Installation command documented above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | apps/desktop/vitest.config.ts |
| Quick run command | `cd apps/desktop && pnpm test` |
| Full suite command | `cd apps/desktop && pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | Gemini API call with structured output, batch processing, prompt construction | unit | `cd apps/desktop && pnpm vitest run src/main/library/ai-enrichment.test.ts -x` | Wave 0 |
| AI-02 | Qualifying track selection (any null field), confidence 'ai' assignment | unit | `cd apps/desktop && pnpm vitest run src/main/library/ai-enrichment.test.ts -x` | Wave 0 |
| AI-03 | UserEdited flags prevent overwrite, manual edit sets flag + confidence | unit | `cd apps/desktop && pnpm vitest run src/main/library/ai-enrichment.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/desktop && pnpm test`
- **Per wave merge:** `cd apps/desktop && pnpm test`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `apps/desktop/src/main/library/ai-enrichment.test.ts` -- covers AI-01, AI-02, AI-03 (mock @google/genai)
- [ ] Install @google/genai and zod in desktop package
- [ ] Restore missing library types in ipc-types.ts (TypeScript prerequisite)

## Critical Prerequisite: ipc-types.ts Restoration

Phase 31 accidentally removed library types from `apps/desktop/src/shared/ipc-types.ts`. The current desktop codebase has 30+ TypeScript errors. Phase 32 MUST restore these types before any new work:

**Types to restore (from commit 43dacc3):**
- `MetadataConfidence` type (then extend to include 'ai')
- `ScanProgressEvent` interface
- `ScanResult` interface
- `LibraryTrack` interface (then extend with *UserEdited fields)
- `DesktopBridgeLibrary` interface (then extend with new enrichment methods)
- Window global declaration augmentation (add DesktopBridgeLibrary)

**Types also missing (not library, but broken):**
- `AudioPrepResult` interface
- `MultiItemCompleteEvent` interface
- `MultiItemProgressEvent` interface
- `SyncResult` / `SyncProgress` (imported in library-ipc.ts from ipc-types but defined in sync-manager.ts)

**Verification:** Run `cd apps/desktop && npx tsc --noEmit` before and after restoration. Must go from 30+ errors to 0 (or only pre-existing errors).

## Sources

### Primary (HIGH confidence)
- [Google Gen AI SDK (js-genai) GitHub](https://github.com/googleapis/js-genai) - Package name, version, API surface, client initialization
- [Gemini API Structured Output Docs](https://ai.google.dev/gemini-api/docs/structured-output) - responseJsonSchema, responseMimeType, Zod integration
- [Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart) - Client creation, GEMINI_API_KEY env var, model name strings
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) - Free tier limits: 10 RPM, 500 RPD for 2.5 Flash
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) - v1.50.1 confirmed via `npm view`
- [Zod 4 Release Notes](https://zod.dev/v4) - Native z.toJSONSchema() replaces zod-to-json-schema

### Secondary (MEDIUM confidence)
- [Gemini 2.0 Flash Shutdown Notice](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-0-flash) - June 1, 2026 EOL, use gemini-2.5-flash
- [Gemini API Pricing Guide](https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration) - Free tier confirmation, no credit card required
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) - OS keychain encryption pattern

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @google/genai is the official SDK, version verified against npm registry, Zod 4 already in project
- Architecture: HIGH - Follows established project patterns (IPC handlers, safeStorage vault, SQLite schema, batch processing)
- Pitfalls: HIGH - ipc-types.ts regression verified by running `tsc --noEmit`, rate limits documented in official docs

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days -- stable domain, models and SDK versions locked)
