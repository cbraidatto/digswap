import Database from "better-sqlite3";
import { app } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { LibraryTrack } from "../../shared/ipc-types";

let db: Database.Database | null = null;

export function getLibraryDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath("userData"), "library.sqlite3");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

export function closeLibraryDb(): void {
  db?.close();
  db = null;
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS library_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tracks (
      id                TEXT PRIMARY KEY,
      filePath          TEXT NOT NULL UNIQUE,
      fileHash          TEXT,
      fileSize          INTEGER NOT NULL,
      modifiedAt        TEXT NOT NULL,
      scannedAt         TEXT NOT NULL,
      artist            TEXT,
      album             TEXT,
      title             TEXT,
      year              INTEGER,
      trackNumber       INTEGER,
      format            TEXT NOT NULL,
      bitrate           INTEGER NOT NULL DEFAULT 0,
      sampleRate        INTEGER NOT NULL DEFAULT 0,
      bitDepth          INTEGER,
      duration          REAL NOT NULL DEFAULT 0,
      artistConfidence  TEXT NOT NULL DEFAULT 'high',
      albumConfidence   TEXT NOT NULL DEFAULT 'high',
      titleConfidence   TEXT NOT NULL DEFAULT 'high',
      yearConfidence    TEXT NOT NULL DEFAULT 'high',
      trackConfidence   TEXT NOT NULL DEFAULT 'high',
      syncedAt          TEXT,
      syncHash          TEXT
    );
    CREATE TABLE IF NOT EXISTS release_mappings (
      albumKey   TEXT PRIMARY KEY,
      releaseId  TEXT NOT NULL,
      updatedAt  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_tracks_synced ON tracks(syncedAt);
  `);
  migrateSchema(database);
}

function migrateSchema(database: Database.Database): void {
  const newColumns = [
    "artistUserEdited INTEGER NOT NULL DEFAULT 0",
    "albumUserEdited INTEGER NOT NULL DEFAULT 0",
    "titleUserEdited INTEGER NOT NULL DEFAULT 0",
    "yearUserEdited INTEGER NOT NULL DEFAULT 0",
    "trackUserEdited INTEGER NOT NULL DEFAULT 0",
  ];
  for (const col of newColumns) {
    const colName = col.split(" ")[0];
    const existing = database
      .prepare(
        "SELECT name FROM pragma_table_info('tracks') WHERE name = ?",
      )
      .get(colName);
    if (!existing) {
      database.exec(`ALTER TABLE tracks ADD COLUMN ${col}`);
    }
  }
}

export interface TrackRow {
  id: string;
  filePath: string;
  fileHash: string | null;
  fileSize: number;
  modifiedAt: string;
  scannedAt: string;
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
  artistConfidence: string;
  albumConfidence: string;
  titleConfidence: string;
  yearConfidence: string;
  trackConfidence: string;
  artistUserEdited: number;
  albumUserEdited: number;
  titleUserEdited: number;
  yearUserEdited: number;
  trackUserEdited: number;
}

export function insertTracks(
  database: Database.Database,
  tracks: TrackRow[],
): void {
  const insert = database.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, filePath, fileHash, fileSize, modifiedAt, scannedAt,
      artist, album, title, year, trackNumber,
      format, bitrate, sampleRate, bitDepth, duration,
      artistConfidence, albumConfidence, titleConfidence, yearConfidence, trackConfidence,
      artistUserEdited, albumUserEdited, titleUserEdited, yearUserEdited, trackUserEdited
    ) VALUES (
      @id, @filePath, @fileHash, @fileSize, @modifiedAt, @scannedAt,
      @artist, @album, @title, @year, @trackNumber,
      @format, @bitrate, @sampleRate, @bitDepth, @duration,
      @artistConfidence, @albumConfidence, @titleConfidence, @yearConfidence, @trackConfidence,
      @artistUserEdited, @albumUserEdited, @titleUserEdited, @yearUserEdited, @trackUserEdited
    )
  `);

  const insertMany = database.transaction((rows: TrackRow[]) => {
    for (const row of rows) {
      insert.run(row);
    }
  });

  for (let i = 0; i < tracks.length; i += 100) {
    insertMany(tracks.slice(i, i + 100));
  }
}

export function removeTracksByPaths(
  database: Database.Database,
  paths: string[],
): void {
  const del = database.prepare("DELETE FROM tracks WHERE filePath = ?");
  const deleteMany = database.transaction((ps: string[]) => {
    for (const p of ps) {
      del.run(p);
    }
  });
  deleteMany(paths);
}

export function getAllTracks(database: Database.Database): TrackRow[] {
  return database
    .prepare("SELECT * FROM tracks ORDER BY artist, album, trackNumber")
    .all() as TrackRow[];
}

export function getLibraryRoot(database: Database.Database): string | null {
  const row = database
    .prepare("SELECT value FROM library_meta WHERE key = 'rootPath'")
    .get() as { value: string } | undefined;
  return row?.value ?? null;
}

export function setLibraryRoot(
  database: Database.Database,
  rootPath: string,
): void {
  database
    .prepare(
      "INSERT OR REPLACE INTO library_meta (key, value) VALUES ('rootPath', ?)",
    )
    .run(rootPath);
}

export function getIndexedFileMtimes(
  database: Database.Database,
): Map<string, string> {
  const rows = database
    .prepare("SELECT filePath, modifiedAt FROM tracks")
    .all() as Array<{ filePath: string; modifiedAt: string }>;
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.filePath, row.modifiedAt);
  }
  return map;
}

export function generateTrackId(): string {
  return randomUUID();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync helpers (Phase 30)
// ─────────────────────────────────────────────────────────────────────────────

export function makeLocalAlbumKey(artist: string | null, album: string | null): string {
  const a = (artist ?? "").toLowerCase().trim();
  const b = (album ?? "").toLowerCase().trim();
  return `${a}::${b}`;
}

export function getUnsyncedTracks(database: Database.Database): TrackRow[] {
  return database.prepare(`
    SELECT * FROM tracks
    WHERE syncedAt IS NULL OR syncedAt < modifiedAt
    ORDER BY artist, album, trackNumber
  `).all() as TrackRow[];
}

export function markTracksSynced(
  database: Database.Database,
  trackIds: string[],
): void {
  const now = new Date().toISOString();
  const stmt = database.prepare(
    "UPDATE tracks SET syncedAt = ? WHERE id = ?",
  );
  const tx = database.transaction((ids: string[]) => {
    for (const id of ids) stmt.run(now, id);
  });
  tx(trackIds);
}

export function getIndexedFilePaths(database: Database.Database): string[] {
  const rows = database.prepare("SELECT filePath FROM tracks").all() as Array<{ filePath: string }>;
  return rows.map(r => r.filePath);
}

export function getReleaseMapping(database: Database.Database, albumKey: string): string | null {
  const row = database.prepare(
    "SELECT releaseId FROM release_mappings WHERE albumKey = ?",
  ).get(albumKey) as { releaseId: string } | undefined;
  return row?.releaseId ?? null;
}

export function setReleaseMappings(
  database: Database.Database,
  mappings: Array<{ albumKey: string; releaseId: string }>,
): void {
  const now = new Date().toISOString();
  const stmt = database.prepare(
    "INSERT OR REPLACE INTO release_mappings (albumKey, releaseId, updatedAt) VALUES (?, ?, ?)",
  );
  const tx = database.transaction((items: typeof mappings) => {
    for (const m of items) stmt.run(m.albumKey, m.releaseId, now);
  });
  tx(mappings);
}

export function getReleaseMappingsForPaths(
  database: Database.Database,
  filePaths: string[],
): string[] {
  const releaseIds = new Set<string>();
  for (const fp of filePaths) {
    const track = database.prepare(
      "SELECT artist, album FROM tracks WHERE filePath = ?",
    ).get(fp) as { artist: string | null; album: string | null } | undefined;
    if (!track) continue;
    const key = makeLocalAlbumKey(track.artist, track.album);
    const mapping = getReleaseMapping(database, key);
    if (mapping) releaseIds.add(mapping);
  }
  return [...releaseIds];
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Enrichment helpers (Phase 32)
// ─────────────────────────────────────────────────────────────────────────────

export function getQualifyingTracks(database: Database.Database): TrackRow[] {
  return database
    .prepare(
      `SELECT * FROM tracks
     WHERE (artist IS NULL AND artistUserEdited = 0)
        OR (album IS NULL AND albumUserEdited = 0)
        OR (title IS NULL AND titleUserEdited = 0)
        OR (year IS NULL AND yearUserEdited = 0)
     ORDER BY filePath`,
    )
    .all() as TrackRow[];
}

export function updateTrackAiMetadata(
  database: Database.Database,
  trackId: string,
  updates: Record<string, string | number>,
  confidenceOverrides: Record<string, string>,
): void {
  const setClauses: string[] = [];
  const values: (string | number)[] = [];
  for (const [key, val] of Object.entries(updates)) {
    setClauses.push(`${key} = ?`);
    values.push(val);
  }
  for (const [key, val] of Object.entries(confidenceOverrides)) {
    setClauses.push(`${key} = ?`);
    values.push(val);
  }
  if (setClauses.length === 0) return;
  values.push(trackId);
  database
    .prepare(`UPDATE tracks SET ${setClauses.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function updateTrackField(
  database: Database.Database,
  trackId: string,
  field: "artist" | "album" | "title" | "year" | "trackNumber",
  value: string | number | null,
): void {
  const editedCol =
    field === "trackNumber" ? "trackUserEdited" : `${field}UserEdited`;
  const confCol =
    field === "trackNumber" ? "trackConfidence" : `${field}Confidence`;
  database
    .prepare(
      `UPDATE tracks SET ${field} = ?, ${editedCol} = 1, ${confCol} = 'high' WHERE id = ?`,
    )
    .run(value, trackId);
}

export function trackRowToLibraryTrack(row: TrackRow): LibraryTrack {
  return {
    id: row.id,
    filePath: row.filePath,
    fileHash: row.fileHash,
    fileSize: row.fileSize,
    modifiedAt: row.modifiedAt,
    scannedAt: row.scannedAt,
    artist: row.artist,
    album: row.album,
    title: row.title,
    year: row.year,
    trackNumber: row.trackNumber,
    format: row.format,
    bitrate: row.bitrate,
    sampleRate: row.sampleRate,
    bitDepth: row.bitDepth,
    duration: row.duration,
    artistConfidence:
      row.artistConfidence as LibraryTrack["artistConfidence"],
    albumConfidence: row.albumConfidence as LibraryTrack["albumConfidence"],
    titleConfidence: row.titleConfidence as LibraryTrack["titleConfidence"],
    yearConfidence: row.yearConfidence as LibraryTrack["yearConfidence"],
    trackConfidence: row.trackConfidence as LibraryTrack["trackConfidence"],
    artistUserEdited: Boolean(row.artistUserEdited),
    albumUserEdited: Boolean(row.albumUserEdited),
    titleUserEdited: Boolean(row.titleUserEdited),
    yearUserEdited: Boolean(row.yearUserEdited),
    trackUserEdited: Boolean(row.trackUserEdited),
  };
}
