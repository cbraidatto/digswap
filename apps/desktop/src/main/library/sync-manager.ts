import { existsSync } from "node:fs";
import type Database from "better-sqlite3";
import {
  getUnsyncedTracks,
  markTracksSynced,
  getIndexedFilePaths,
  setReleaseMappings,
  getReleaseMappingsForPaths,
  makeLocalAlbumKey,
  type TrackRow,
} from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────���─────────────────────────

export interface TrackSyncPayload {
  localTrackId: string;
  artist: string | null;
  album: string | null;
  title: string | null;
  year: number | null;
  trackNumber: number | null;
  format: string;
  bitrate: number;
  sampleRate: number;
  bitDepth: number | null;
  duration: number;
  fileHash: string | null;
  fileSize: number;
  artistConfidence: string;
  albumConfidence: string;
}

export interface SyncProgress {
  phase: "preparing" | "uploading" | "deleting" | "done" | "error";
  total: number;
  sent: number;
  message: string;
}

export interface SyncResult {
  synced: number;
  created: number;
  linked: number;
  deleted: number;
  errors: string[];
}

// ────────────────────────��────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 75;

// ─────────────────────────────────────────────────────────────────────────────
// Public helpers (exported for testing)
// ────────────────────────────────────────────────────────────────────────���────

export function groupTracksByAlbum(tracks: TrackRow[]): Record<string, TrackRow[]> {
  const groups: Record<string, TrackRow[]> = {};
  for (const track of tracks) {
    const key = makeLocalAlbumKey(track.artist, track.album);
    if (!groups[key]) groups[key] = [];
    groups[key].push(track);
  }
  return groups;
}

export function buildTrackPayload(track: TrackRow): TrackSyncPayload {
  return {
    localTrackId: track.id,
    artist: track.artist,
    album: track.album,
    title: track.title,
    year: track.year,
    trackNumber: track.trackNumber,
    format: track.format,
    bitrate: track.bitrate,
    sampleRate: track.sampleRate,
    bitDepth: track.bitDepth,
    duration: track.duration,
    fileHash: track.fileHash,
    fileSize: track.fileSize,
    artistConfidence: track.artistConfidence,
    albumConfidence: track.albumConfidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main sync function
// ─────────────────────────────────────────────────────────────────────────────

export async function startSync(
  db: Database.Database,
  webAppUrl: string,
  getAccessToken: () => Promise<string | null>,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, created: 0, linked: 0, deleted: 0, errors: [] };

  const token = await getAccessToken();
  if (!token) {
    return { ...result, errors: ["Not authenticated — cannot sync"] };
  }

  // --- Detect deleted files ---
  const indexedPaths = getIndexedFilePaths(db);
  const deletedPaths: string[] = [];
  for (const p of indexedPaths) {
    if (!existsSync(p)) {
      deletedPaths.push(p);
    }
  }
  // Look up web-side release IDs for deleted paths
  const deletedReleaseIds = getReleaseMappingsForPaths(db, deletedPaths);

  // --- Get unsynced tracks ---
  const unsynced = getUnsyncedTracks(db);
  onProgress?.({
    phase: "preparing",
    total: unsynced.length,
    sent: 0,
    message: `${unsynced.length} tracks to sync`,
  });

  const payloads = unsynced.map(buildTrackPayload);
  const batches: TrackSyncPayload[][] = [];
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    batches.push(payloads.slice(i, i + BATCH_SIZE));
  }

  // --- Send batches ---
  let sent = 0;
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    onProgress?.({
      phase: "uploading",
      total: payloads.length,
      sent,
      message: `Sending batch ${bi + 1}/${batches.length}`,
    });

    try {
      const response = await fetch(`${webAppUrl}/api/desktop/library/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tracks: batch,
          // Send deletedReleaseIds with first batch only
          deletedReleaseIds: bi === 0 ? deletedReleaseIds : [],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        result.errors.push(`Batch failed (${response.status}): ${err}`);
        continue;
      }

      const data = await response.json() as {
        synced?: number;
        created?: number;
        linked?: number;
        deleted?: number;
        errors?: string[];
        releaseMappings?: Array<{ albumKey: string; releaseId: string }>;
      };

      result.synced += data.synced ?? 0;
      result.created += data.created ?? 0;
      result.linked += data.linked ?? 0;
      result.deleted += data.deleted ?? 0;

      // Mark tracks as synced in SQLite
      const trackIds = batch.map(t => t.localTrackId);
      markTracksSynced(db, trackIds);
      sent += batch.length;

      // Store release mappings from server response
      if (data.releaseMappings && data.releaseMappings.length > 0) {
        setReleaseMappings(db, data.releaseMappings);
      }
    } catch (err) {
      result.errors.push(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Handle case where there are no unsynced tracks but there are deletions
  if (batches.length === 0 && deletedReleaseIds.length > 0) {
    onProgress?.({
      phase: "deleting",
      total: 0,
      sent: 0,
      message: `Sending ${deletedReleaseIds.length} deletions`,
    });

    try {
      const response = await fetch(`${webAppUrl}/api/desktop/library/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tracks: [], deletedReleaseIds }),
      });

      if (response.ok) {
        const data = await response.json() as { deleted?: number };
        result.deleted += data.deleted ?? 0;
      }
    } catch (err) {
      result.errors.push(`Deletion sync error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  onProgress?.({
    phase: "done",
    total: payloads.length,
    sent,
    message: "Sync complete",
  });

  return result;
}
