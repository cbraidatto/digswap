import React from "react";
import type { LibraryTrack, MetadataConfidence } from "../../shared/ipc-types";

interface Props {
  tracks: LibraryTrack[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface AlbumGroup {
  album: string;
  albumConfidence: MetadataConfidence;
  artist: string | null;
  artistConfidence: MetadataConfidence;
  year: number | null;
  tracks: LibraryTrack[];
}

function groupByAlbum(tracks: LibraryTrack[]): AlbumGroup[] {
  const groups = new Map<string, AlbumGroup>();

  for (const track of tracks) {
    const albumKey = track.album?.trim() || "Album Desconhecido";

    if (!groups.has(albumKey)) {
      groups.set(albumKey, {
        album: albumKey,
        albumConfidence: albumKey === "Album Desconhecido" ? "low" : track.albumConfidence,
        artist: track.artist,
        artistConfidence: track.artistConfidence,
        year: track.year,
        tracks: [],
      });
    }

    groups.get(albumKey)!.tracks.push(track);
  }

  // Sort tracks within each group by trackNumber (nulls last), then title
  for (const group of groups.values()) {
    group.tracks.sort((a, b) => {
      if (a.trackNumber !== null && b.trackNumber !== null) return a.trackNumber - b.trackNumber;
      if (a.trackNumber !== null) return -1;
      if (b.trackNumber !== null) return 1;
      return (a.title ?? "").localeCompare(b.title ?? "");
    });
  }

  // Sort groups alphabetically, "Album Desconhecido" last
  const sorted = [...groups.values()].sort((a, b) => {
    if (a.album === "Album Desconhecido") return 1;
    if (b.album === "Album Desconhecido") return -1;
    return a.album.localeCompare(b.album);
  });

  return sorted;
}

export function LibraryAlbumView({ tracks }: Props) {
  const albums = groupByAlbum(tracks);

  return (
    <div className="overflow-auto flex-1">
      {albums.map((group) => (
        <div key={group.album}>
          {/* Album header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-[#111008] border-b border-[#2a2218]">
            <div className="flex items-baseline gap-2 min-w-0">
              {group.album === "Album Desconhecido" ? (
                <span className="text-sm font-semibold text-[#4a4035] italic truncate">
                  {group.album}
                </span>
              ) : group.albumConfidence === "low" ? (
                <span
                  className="text-sm font-semibold text-[#8b7355] italic truncate"
                  title="Inferido do caminho do arquivo"
                >
                  {group.album}
                </span>
              ) : (
                <span className="text-sm font-semibold text-[#e8dcc8] truncate">
                  {group.album}
                </span>
              )}

              {group.artist && (
                <>
                  <span className="text-sm text-[#4a4035]"> -- </span>
                  {group.artistConfidence === "low" ? (
                    <span
                      className="text-sm text-[#8b7355] italic truncate"
                      title="Inferido do caminho do arquivo"
                    >
                      {group.artist}
                    </span>
                  ) : (
                    <span className="text-sm text-[#7a6e5f] truncate">
                      {group.artist}
                    </span>
                  )}
                </>
              )}

              {group.year && (
                <span className="text-xs text-[#4a4035] shrink-0">
                  ({group.year})
                </span>
              )}
            </div>

            <span className="text-xs text-[#4a4035] shrink-0 ml-4">
              {group.tracks.length} faixas
            </span>
          </div>

          {/* Track rows */}
          {group.tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center pl-8 pr-4 py-1.5 border-b border-[#2a2218]/50 hover:bg-[#111008]/50 text-sm"
            >
              <div className="w-[32px] text-xs font-mono text-[#4a4035]">
                {track.trackNumber ?? ""}
              </div>
              <div className="flex-1 truncate">
                {track.titleConfidence === "low" ? (
                  <span
                    className="text-[#8b7355] italic"
                    title="Inferido do caminho do arquivo"
                  >
                    {track.title ?? "--"}
                  </span>
                ) : (
                  <span className="text-[#e8dcc8]">{track.title ?? "--"}</span>
                )}
              </div>
              <div className="w-[60px] text-center text-xs font-mono text-[#4a4035]">
                {track.format}
              </div>
              <div className="w-[60px] text-right text-xs font-mono text-[#4a4035]">
                {formatDuration(track.duration)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
