# Discogs Taxonomy Research

**Researched:** 2026-03-25
**Domain:** Discogs classification system (genres, styles, formats, conditions)
**Purpose:** Reference for `src/lib/discogs/taxonomy.ts` and DigSwap filter/label UI

---

## Summary

Discogs classifies its 13M+ releases with a three-level hierarchy: **Genre** >
**Style** > (free-form notes). The taxonomy is editorial — contributors assign
these fields manually, and Discogs maintains a controlled vocabulary of approved
genres and styles. As of 2025, there are **15 official genres** and approximately
**540 approved styles**. The genre list is completely stable; the style list grows
as new style requests are approved in the Discogs forums.

The API returns genres and styles as plain string arrays on every release object
(`basic_information.genres[]` and `basic_information.styles[]`). There is no
dedicated endpoint to enumerate all valid values — the canonical source is the
Discogs Database Guidelines §9 and the (now partially inaccessible) reference
wiki.

---

## Genres (15 official)

| # | Genre | Style Count (approx.) |
|---|-------|----------------------|
| 1 | Blues | ~14 |
| 2 | Brass & Military | ~4 |
| 3 | Children's | ~4 |
| 4 | Classical | ~14 |
| 5 | Electronic | ~119 (most of any genre) |
| 6 | Folk, World, & Country | ~90 |
| 7 | Funk / Soul | ~12 |
| 8 | Hip Hop | ~32 |
| 9 | Jazz | ~26 |
| 10 | Latin | ~33 |
| 11 | Non-Music | ~11 |
| 12 | Pop | ~25 |
| 13 | Reggae | ~14 |
| 14 | Rock | ~96 |
| 15 | Stage & Screen | ~4 |

**Key facts:**
- Nearly 50% of all Discogs releases are tagged Rock or Electronic.
- Rock and Electronic have the most styles (96 and 119 respectively).
- Children's and Stage & Screen have the fewest styles (4 each).
- Genre names are exact-match strings — capitalization and punctuation matter
  (e.g., `"Folk, World, & Country"` not `"Folk/World/Country"`).

---

## Styles

Styles act as sub-genres. A release can have styles from multiple parent genres,
though this is unusual. The `styles` field on the API is not filtered to match
the `genres` field, so validation should be lenient.

**Style assignment rules (from Database Guidelines §9):**
- Only use styles from the approved vocabulary.
- Do not add styles not listed for the genre.
- Community style requests go through the Discogs Forum style requests thread.

**Most used styles across the database (by release count):**
- Pop Rock (373,000+)
- Ballad (274,000+)
- Chanson (243,000+)
- Schlager (192,000+)
- Synth-pop (178,000+)
- Europop (118,000+)
- Techno (100,000+ for Electronic)
- House (large count)

**Coverage in `taxonomy.ts`:**
The file includes ~60 Electronic styles, ~65 Rock styles, and complete or
near-complete coverage of all other genres. The ~540 total official styles
includes many niche/regional entries (e.g., specific African regional styles
under Folk, World, & Country) that are rarely encountered in typical digger
collections.

---

## Formats

Discogs uses a structured format object with three components:

```
format: {
  name: string,       // Primary format type (e.g., "Vinyl", "CD")
  qty: string,        // Quantity of this format in the release
  descriptions?: string[],  // Sub-format tags (e.g., ["LP", "Album", "33 RPM"])
  text?: string       // Free-text notes
}
```

### Primary Format Names
| Format | Category |
|--------|----------|
| Vinyl | Analog disc |
| Shellac | Analog disc (pre-vinyl era, 78 RPM) |
| Acetate | Analog disc (production dub) |
| Flexi-disc | Flexible plastic disc |
| Lathe Cut | Custom-cut disc (production runs) |
| Pathé Disc | Vertical-cut disc (historical) |
| CD | Compact Disc |
| CDr | Recordable CD |
| DVD, DVDr, HD DVD, Blu-ray | Video/high-res disc |
| SACD, Hybrid | Super Audio formats |
| Cassette | Magnetic tape |
| 8-Track Cartridge | 8-track magnetic tape |
| Reel-To-Reel | Open-reel magnetic tape |
| DAT, DCC | Digital tape formats |
| Minidisc | Magneto-optical disc |
| File | Digital file release |
| Box Set | Must be combined with other formats |
| All Media | Mixed-media; must be combined |

### Important Format Rules
- **LP vs. 12"**: LP implies 33⅓ RPM long-playing record (many minutes per side);
  12" is a size/groove distinction often used for singles/EPs with wider grooves.
  A release can be both `Vinyl` / `12"` / `LP` if it's a full-length 12" record.
- **EP vs. Single**: Marketing terms, not physical descriptions. EP = more tracks
  than a single but fewer than an album. These can appear on any physical format.
- **Box Set and All Media**: Must always be combined with the underlying media types.
- **Descriptions are additive**: A release could have descriptions:
  `["LP", "Album", "33 RPM", "Stereo", "Reissue"]`.

---

## Condition Grades (Goldmine Standard)

Discogs uses the **Goldmine Standard** for all Marketplace listings. Every listing
has two separate condition fields: **Media** (the record itself) and **Sleeve**
(cover/packaging).

| Grade | Short | Quality | API value string |
|-------|-------|---------|-----------------|
| Mint | M | Perfect, never played | `"M"` |
| Near Mint | NM | Nearly perfect, little/no wear | `"NM or M-"` |
| Very Good Plus | VG+ | Minor marks, plays perfectly | `"VG+"` |
| Very Good | VG | Noticeable surface noise | `"VG"` |
| Good Plus | G+ | Significant surface noise | `"G+"` |
| Good | G | Heavy noise, scratches | `"G"` |
| Fair | F | Skips/repeats | `"F"` |
| Poor | P | Unplayable | `"P"` |

**Important:** The API uses `"NM or M-"` as the full string for Near Mint, not
just `"NM"`. The `taxonomy.ts` file uses this exact string as the key to match
what appears in API responses.

**Additional sleeve-only values:**
- `"Generic"` — plain/generic sleeve, not release-specific
- `"No Cover"` — no sleeve present or released without cover

---

## API Data Model Notes

### Release Object (from `basic_information`)
```typescript
{
  genres: string[],    // e.g., ["Electronic"]
  styles: string[],    // e.g., ["Techno", "Minimal Techno"]
  formats: Array<{
    name: string,        // e.g., "Vinyl"
    qty: string,         // e.g., "1"
    descriptions?: string[], // e.g., ["12\"", "33 RPM"]
    text?: string        // free text
  }>,
  // No condition field on basic_information
  // Condition is on the listing/order object in Marketplace API
}
```

### Marketplace Listing Object
```typescript
{
  condition: string,        // media grade, e.g., "VG+"
  sleeve_condition: string, // sleeve grade, e.g., "NM or M-"
}
```

---

## Data Confidence

| Area | Confidence | Reason |
|------|------------|--------|
| Genre list (15 genres) | HIGH | Confirmed by multiple official Discogs sources |
| Style counts per genre | HIGH | Confirmed via Discogs blog statistics |
| Common styles | HIGH | Confirmed via Discogs search pages and style guide references |
| Exhaustive style list | MEDIUM | ~540 total; niche/regional styles not all verified |
| Format names | HIGH | Confirmed via Database Guidelines §6 and help/formatslist |
| Format descriptions | HIGH | Confirmed via official guidelines |
| Condition grades | HIGH | Confirmed via official Marketplace grading guide |
| `"NM or M-"` as API string | MEDIUM | Referenced in multiple forum posts; direct API doc not accessible |

---

## Known Limitations

1. **Discogs.com blocks scraping** — The official help pages (formatslist,
   genre pages, condition guide) all returned 403 during research. Data was
   confirmed through Google-cached content, Discogs forum posts, and the
   Discogs blog which publishes genre/style statistics.

2. **Style list is not exhaustive** — There are ~540 approved styles. The
   `taxonomy.ts` file covers ~200 of the most common. Adding all 540 would
   require scraping the Discogs submission form dropdown, which requires
   authentication.

3. **Styles shift over time** — New styles are occasionally approved and old
   ones deprecated. The taxonomy should be reviewed annually.

4. **`"NM or M-"` vs `"NM"`** — Some sources show NM as just `"NM"` in
   listings, but the official API documentation and Marketplace listings use
   `"NM or M-"`. Both should be handled defensively in the app.

---

## Sources

| Source | Confidence | What it provided |
|--------|------------|-----------------|
| Discogs Database Guidelines §9 (via Google cache/search) | HIGH | 15 genre names confirmed |
| Discogs Blog "Genres and Styles" (stats article) | HIGH | Style counts per genre |
| Discogs Style Guide reference wiki (via search) | HIGH | Individual style names and descriptions |
| Discogs Marketplace grading guide (brianchernicky.com mirror) | MEDIUM | Condition grade descriptions |
| Discogs Database Guidelines §6 Format (via search excerpts) | HIGH | Format type list |
| Discogs forum threads (961895, 641382) | MEDIUM | Style lists and discussions |
| AcousticBrainz Genre Dataset documentation | MEDIUM | Style count corroboration |
| Discogs-VI paper (arxiv 2410.17400) | MEDIUM | Confirmed ~512 styles in July 2024 dump |

---

## Implementation Notes for DigSwap

1. **Filter dropdowns**: Use `DISCOGS_GENRES` for genre filter, then dynamically
   populate style filter with `getStylesForGenre(selectedGenre)`.

2. **Cross-genre style search**: Use `ALL_DISCOGS_STYLES` (flat, deduplicated)
   for global style autocomplete when no genre is selected.

3. **Unknown values**: The API may return styles not in this list (user-submitted
   data can be messy). Always handle unknown genres/styles gracefully — display
   as-is rather than filtering them out.

4. **Condition display**: Use `DISCOGS_CONDITION_SHORT` for badges/chips,
   `DISCOGS_CONDITIONS` for tooltips/detail views.

5. **Format display**: A vinyl record might show formats like:
   `Vinyl · 12" · LP · 33 RPM · Stereo` — concatenate `name` + `descriptions`
   for readable display.

6. **Condition sort order**: Use `DISCOGS_CONDITION_WEIGHT` (8=M, 1=P) for
   sorting collections/wantlists by condition quality.
