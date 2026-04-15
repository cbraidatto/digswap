export interface InferredMetadata {
  artist?: string;
  album?: string;
  year?: number;
  trackNumber?: number;
  title?: string;
}

const PATTERNS: RegExp[] = [
  // 1. Artist/Album (Year)/NN - Title.ext
  /^(?<artist>[^/]+)\/(?<album>[^/]+?)\s*\((?<year>\d{4})\)\/(?<track>\d+)\s*-\s*(?<title>.+)\.\w+$/,
  // 2. Artist/Album/NN - Title.ext
  /^(?<artist>[^/]+)\/(?<album>[^/]+)\/(?<track>\d+)\s*-\s*(?<title>.+)\.\w+$/,
  // 3. Artist - Album (Year)/Title.ext
  /^(?<artist>[^/]+?)\s*-\s*(?<album>[^/]+?)\s*\((?<year>\d{4})\)\/(?<title>.+)\.\w+$/,
  // 4. Artist - Album/NN. Title.ext
  /^(?<artist>[^/]+?)\s*-\s*(?<album>[^/]+)\/(?<track>\d+)\.\s*(?<title>.+)\.\w+$/,
  // 5. NN - Title.ext (flat folder -- may have parent dirs)
  /^(?:.*\/)?(?<track>\d+)\s*-\s*(?<title>.+)\.\w+$/,
];

export function inferFromPath(relativePath: string): InferredMetadata | null {
  const normalized = relativePath
    .replace(/\\/g, "/")
    .trim()
    .replace(/\s*\/\s*/g, "/");
  for (const pattern of PATTERNS) {
    const match = normalized.match(pattern);
    if (match?.groups) {
      return {
        artist: match.groups.artist?.trim(),
        album: match.groups.album?.trim(),
        year: match.groups.year ? parseInt(match.groups.year, 10) : undefined,
        trackNumber: match.groups.track
          ? parseInt(match.groups.track, 10)
          : undefined,
        title: match.groups.title?.trim(),
      };
    }
  }

  // Fallback: extract title from filename, artist from parent folder
  const parts = normalized.split("/");
  const filename = parts[parts.length - 1];
  const titleFromFile = filename.replace(/\.\w+$/, "").replace(/^\d+[\s._-]+/, "").trim();
  const parentFolder = parts.length >= 2 ? parts[parts.length - 2]?.trim() : undefined;

  if (titleFromFile) {
    return {
      title: titleFromFile,
      artist: parentFolder || undefined,
    };
  }

  return null;
}
