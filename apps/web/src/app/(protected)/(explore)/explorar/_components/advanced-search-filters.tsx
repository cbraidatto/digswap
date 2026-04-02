"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

const GENRE_OPTIONS = [
  "Jazz",
  "Rock",
  "Electronic",
  "Soul",
  "Funk / Soul",
  "Hip Hop",
  "Classical",
  "Pop",
  "Country",
  "Blues",
  "Reggae",
  "Latin",
] as const;

const FORMAT_OPTIONS = [
  { label: "All Formats", value: "" },
  { label: "LP", value: "LP" },
  { label: '7"', value: '7"' },
  { label: '10"', value: '10"' },
  { label: "CD", value: "CD" },
] as const;

export function AdvancedSearchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read current values from URL
  const activeGenres = searchParams.getAll("genre");
  const activeCountry = searchParams.get("country") ?? "";
  const activeFormat = searchParams.get("format") ?? "";
  const activeMinRarity = Number(searchParams.get("minRarity") ?? "0");

  const updateParam = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        params.delete(key);
        if (Array.isArray(value)) {
          for (const v of value) {
            params.append(key, v);
          }
        } else if (value !== null && value !== "") {
          params.set(key, value);
        }
      }

      // Preserve tab param if set
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams],
  );

  const toggleGenre = (genre: string) => {
    const next = activeGenres.includes(genre)
      ? activeGenres.filter((g) => g !== genre)
      : [...activeGenres, genre];
    updateParam({ genre: next });
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParam({ country: e.target.value });
  };

  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateParam({ format: e.target.value });
  };

  const handleMinRarityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    updateParam({ minRarity: val > 0 ? String(val) : null });
  };

  const hasActiveFilters =
    activeGenres.length > 0 ||
    activeCountry !== "" ||
    activeFormat !== "" ||
    activeMinRarity > 0;

  const clearAll = () => {
    updateParam({ genre: [], country: null, format: null, minRarity: null });
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-on-surface-variant uppercase tracking-[0.2em]">
          FILTERS
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-xs text-primary hover:underline"
          >
            CLEAR_ALL
          </button>
        )}
      </div>

      {/* Genre chips — horizontally scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {GENRE_OPTIONS.map((genre) => {
          const isActive = activeGenres.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              aria-pressed={isActive}
              className={`px-3 py-1 rounded-full font-mono text-xs whitespace-nowrap shrink-0 transition-colors border ${
                isActive
                  ? "bg-primary/10 text-primary border-primary"
                  : "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>

      {/* Second row: country, format, minRarity */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Country */}
        <div className="flex flex-col gap-1 min-w-[120px]">
          <label className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
            Country
          </label>
          <input
            type="text"
            value={activeCountry}
            onChange={handleCountryChange}
            placeholder="e.g. US, UK..."
            className="bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 w-full"
          />
        </div>

        {/* Format */}
        <div className="flex flex-col gap-1 min-w-[100px]">
          <label className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
            Format
          </label>
          <select
            value={activeFormat}
            onChange={handleFormatChange}
            className="bg-surface-container-low border border-outline-variant/20 rounded px-2 py-1 font-mono text-xs text-on-surface focus:outline-none focus:border-primary/50"
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Min Rarity */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
            Min Rarity:{" "}
            <span className="text-primary">{activeMinRarity}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={activeMinRarity}
            onChange={handleMinRarityChange}
            className="accent-primary w-full"
          />
        </div>
      </div>
    </div>
  );
}
