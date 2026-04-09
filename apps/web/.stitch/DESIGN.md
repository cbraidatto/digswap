# Design System: DigSwap

> Source of truth for DigSwap's visual language. Every new screen, component, or page must align with this document. When generating UI with Stitch or building with code, reference these tokens — never invent colors, fonts, or spacing from scratch.

---

## 1. Visual Theme & Atmosphere

**Identity:** Dark-mode-first social network for vinyl collectors with a cyber-terminal aesthetic. The interface feels like a hacker's record shop — monospace labels, bracket notation, grain texture overlays, and neon accent colors against deep dark surfaces. It's serious tooling wrapped in underground culture.

**Atmosphere Dials:**
- Density: **7/10** — Information-dense feeds and stats, but generous whitespace between sections
- Variance: **6/10** — Consistent card patterns with deliberate variation in feature showcases and hero sections
- Motion Intent: **5/10** — Purposeful entrance animations and hover feedback, never gratuitous
- Creativity: **8/10** — Terminal-inspired UI language (bracket labels, blinking cursors, monospace data) layered with vinyl culture motifs (grain texture, disc skeletons, cover art focus)

**Vibe Keywords:** Underground, utilitarian, data-forward, collector-grade, dark terminal, analog warmth over digital coldness.

---

## 2. Color Palette & Roles

DigSwap uses a **4-theme system** with Material Design 3-inspired semantic tokens. All themes share the same token structure — only the values change. Every color reference in code uses semantic tokens (`primary`, `surface-container-low`, etc.), never raw hex.

### Theme: Ghost Protocol (Default)

The signature theme. Neon green on deep navy — Matrix-meets-vinyl-shop.

| Role | Token | Hex | Description |
|------|-------|-----|-------------|
| **Primary** | `--primary` | `#6fdd78` | Neon Terminal Green — CTAs, active states, highlights, ring focus |
| **Primary Foreground** | `--primary-foreground` | `#00390e` | Text on primary backgrounds |
| **Primary Container** | `--primary-container` | `#34a547` | Deeper green for contained elements |
| **Secondary** | `--secondary` | `#aac7ff` | Soft Signal Blue — rare tier badges, stats accents, secondary actions |
| **Tertiary** | `--tertiary` | `#ffb689` | Warm Amber — ultra-rare tier, star ratings, warm highlights |
| **Background** | `--background` | `#10141a` | Deep Navy Black — page canvas |
| **Surface** | `--surface` | `#10141a` | Base surface layer |
| **Surface Container Lowest** | `--surface-container-lowest` | `#0a0e14` | Deepest recessed areas |
| **Surface Container Low** | `--surface-container-low` | `#181c22` | Cards, panels, default containers |
| **Surface Container** | `--surface-container` | `#1c2026` | Popovers, secondary containers |
| **Surface Container High** | `--surface-container-high` | `#262a31` | Elevated elements, skeletons, accents |
| **Surface Container Highest** | `--surface-container-highest` | `#31353c` | Highest elevation surfaces |
| **On Surface** | `--on-surface` | `#dfe2eb` | Primary text on dark backgrounds |
| **On Surface Variant** | `--on-surface-variant` | `#becab9` | Secondary/muted text, captions |
| **Outline** | `--outline` | `#889484` | Visible borders, dividers |
| **Outline Variant** | `--outline-variant` | `#3e4a3d` | Subtle borders, card edges (typically at /10 to /30 opacity) |
| **Destructive** | `--destructive` | `#ffb4ab` | Error states, danger actions |
| **Error** | `--error` | `#ffb4ab` | Form errors, system alerts |
| **Foreground** | `--foreground` | `#dfe2eb` | Default text color |
| **Muted Foreground** | `--muted-foreground` | `#becab9` | Subdued labels, helper text |
| **Card** | `--card` | `#181c22` | Card background |
| **Inverse Surface** | `--inverse-surface` | `#dfe2eb` | Light-on-dark inversions |

### Theme: Chrome

Silver monochrome. Cold steel. For collectors who want zero distraction.

| Role | Hex | Note |
|------|-----|------|
| Primary | `#c0c8d4` | Light Silver |
| Secondary | `#8090a0` | Steel Gray |
| Tertiary | `#78a0c0` | Slate Blue |
| Background | `#0c0d0f` | Near-Black |
| On Surface | `#e4e8ee` | Light Gray |

### Theme: Rust Furnace

Ember orange on cold steel. Industrial, warm, confident.

| Role | Hex | Note |
|------|-----|------|
| Primary | `#ff5c1a` | Burnt Orange |
| Secondary | `#4a7898` | Cold Slate |
| Tertiary | `#e0a030` | Golden Ember |
| Background | `#09090c` | Darkest Black |
| On Surface | `#e8e2dc` | Warm Cream |

### Theme: Deep Indigo

Jazz club electricity. Neon blue and purple on navy.

| Role | Hex | Note |
|------|-----|------|
| Primary | `#60b4ff` | Electric Blue |
| Secondary | `#b068f8` | Violet |
| Tertiary | `#ff8080` | Coral |
| Background | `#080c18` | Deep Navy |
| On Surface | `#d8e2f8` | Ice Blue |

### Special Colors (Theme-Independent)

| Purpose | Hex | Usage |
|---------|-----|-------|
| **Premium Gold** | `#c8914a` | Premium badge, trade quota banners, tier-specific branding. Always at `/10` bg, `/30` border, `100%` text. |
| **Showcase Accents** | `#e8a427`, `#c0392b`, `#2980b9`, `#27ae60`, `#8e44ad` | Feed showcase category cards (Wantlist, Trades, Rarity, Community, Discovery). Used only in marquee showcase. |

### Rarity Tier Color System

The three-tier rarity system maps directly to the semantic color tokens across all themes:

| Tier | Score | Color Token | Ghost Hex | Visual Treatment |
|------|-------|-------------|-----------|-----------------|
| **Ultra Rare** | >= 2.0 | `tertiary` | `#ffb689` | `bg-tertiary/10 text-tertiary border-tertiary/25` |
| **Rare** | >= 0.5 | `secondary` | `#aac7ff` | `bg-secondary/10 text-secondary border-secondary/25` |
| **Common** | < 0.5 | `primary` | `#6fdd78` | `bg-primary/10 text-primary border-primary/25` |

This ensures rarity colors automatically adapt when switching themes.

---

## 3. Typography Rules

### Font Stack

| Role | Font Family | Variable | Weights | Usage |
|------|-------------|----------|---------|-------|
| **Body** | Inter | `--font-inter` → `font-sans` | 300, 400, 500, 600 | Body text, paragraphs, descriptions |
| **Headings** | Space Grotesk | `--font-space-grotesk` → `font-heading` | 300, 400, 500, 600, 700 | Page titles, section headings, feature names |
| **Monospace** | JetBrains Mono | `--font-jetbrains-mono` → `font-mono` | 400, 500 | Data labels, stats, timestamps, status codes, pagination, badges, terminal UI |
| **Icons** | Material Symbols Outlined | CDN-loaded | 400 | All iconography. `FILL 0` default, `FILL 1` for active/selected states |

### Type Scale

| Element | Classes | Example |
|---------|---------|---------|
| Hero Display | `font-heading text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter` | Landing page headline |
| Page Title | `font-heading text-3xl font-extrabold uppercase tracking-tight` | Radar, Trades page titles |
| Section Heading | `font-heading text-xl md:text-2xl font-bold` | Card section titles |
| Card Title | `font-heading text-sm font-semibold` | Feed card record names |
| Body | `font-sans text-sm text-on-surface` | Descriptions, paragraphs |
| Caption/Label | `font-mono text-xs text-on-surface-variant` | Timestamps, metadata |
| Data Label | `font-mono text-[10px] font-semibold uppercase tracking-[0.2em]` | Section labels, filter chips |
| Micro Badge | `font-mono text-[9px] uppercase tracking-widest` | Premium badge, achievement pills |
| Stats Number | `font-heading text-2xl md:text-3xl font-bold text-primary` | Stat counters |

### Typography Rules

- **Headings always use `font-heading`** (Space Grotesk). Never Inter for headings.
- **Data and labels always use `font-mono`** (JetBrains Mono). Stats, timestamps, badges, status indicators, pagination — all mono.
- **Body text uses `font-sans`** (Inter). Only for paragraphs, descriptions, long-form content.
- **Terminal notation**: Status labels use bracket format: `[ULTRA_RARE]`, `[DIGGING_TRIP]`, `[NO_MATCHES]`
- **Uppercase tracking**: Data labels get `uppercase tracking-[0.2em]` for the terminal feel
- **Icon sizing**: Material Symbols use `text-[18px]` to `text-[24px]` via `fontSize` style prop. Active icons get `fontVariationSettings: "'FILL' 1"`.

---

## 4. Component Stylings

### Buttons

| Variant | Classes |
|---------|---------|
| **Primary CTA** | `bg-primary text-on-primary shadow-lg shadow-primary/20 hover:brightness-110 font-mono text-sm` |
| **Secondary** | `bg-surface-container-low border border-outline-variant/20 text-on-surface hover:bg-surface-container-high font-mono text-sm` |
| **Ghost/Text** | `text-on-surface-variant hover:text-on-surface font-mono text-xs` |
| **Destructive** | `bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20` |
| **Icon-only** | `w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high` |

### Cards

| Pattern | Classes |
|---------|---------|
| **Base Card** | `bg-surface-container-low border border-outline-variant/10 rounded-xl` |
| **Card Hover** | `hover:border-outline-variant/30 transition-colors` or `hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5` |
| **Elevated Card** | `bg-surface-container-high/50 backdrop-blur-sm rounded-xl border border-outline-variant/10` |
| **Feed Card** | Base card + `h-0.5` top accent strip colored by rarity tier + 88px cover art + info grid |

### Rarity Pill

```
inline-flex items-center gap-1 font-mono text-[10px] font-semibold
px-2 py-0.5 rounded-full border
bg-{tier}/10 text-{tier} border-{tier}/25
```

Shows tier label + optional numeric score (e.g., "Rare 1.8").

### Premium Badge

```
inline-flex items-center bg-[#c8914a]/10 border border-[#c8914a]/30
text-[#c8914a] font-mono text-[9px] uppercase tracking-widest
px-1.5 py-0.5 rounded
```

Theme-independent warm bronze gold. Always the same across all 4 themes.

### Star Rating

Unicode stars (`\u2605` filled, `\u2606` empty) in `font-mono text-sm`. Filled stars use `text-tertiary`, empty stars use `text-on-surface-variant/40`.

### Navigation Pill (Header)

```
Active:   bg-primary/15 text-primary font-semibold
Inactive: text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/80
```

Material Symbol icon + label. Icon fills (`FILL 1`) when active.

### Filter Chip (Radar)

```
Active:   border-primary text-primary bg-primary/10
Inactive: border-outline-variant/20 text-on-surface-variant
Format:   [LABEL] bracket notation, font-mono text-xs uppercase
```

### Cover Art

Responsive sizes: `xs(32px)` → `sm(40px)` → `md(48px)` → `lg(80px)` → `xl(120px)` → `full(100%)`. Rounded corners, `bg-surface-container-high` fallback with album icon at `text-on-surface-variant/30`. Always `object-cover`.

### Skeleton Loaders

- **Base**: `bg-surface-container-high rounded animate-pulse`
- **Disc Skeleton**: Circular with vinyl groove rings (concentric borders at decreasing opacity), `animate-[spin_3s_linear_infinite]`
- **Shimmer**: `linear-gradient(90deg, #181c22 25%, #262a31 50%, #181c22 75%)` at 200% width, 1.5s animation

### Toasts (Sonner)

Hardcoded to Ghost Protocol values for consistency:
```
background: #181c22
border: 1px solid #3e4a3d
color: #dfe2eb
fontFamily: JetBrains Mono, monospace
```

---

## 5. Layout Principles

### Page Widths

| Context | Max Width | Usage |
|---------|-----------|-------|
| Mobile compact | `max-w-xs` (320px) | Mobile-first containers |
| Auth forms | `max-w-[420px]` | Sign in, sign up, forgot password |
| Onboarding wide | `max-w-[520px]` | Onboarding steps |
| Content pages | `max-w-[640px]` | Notifications, settings |
| Medium content | `max-w-2xl` (672px) | Trades list |
| Wide content | `max-w-4xl` (896px) | Radar, explore |
| Profile | `max-w-5xl` (1024px) | Profile page with tabs |

### Grid Patterns

- Single column on mobile (default)
- `md:grid-cols-2` for card pairs
- `md:grid-cols-3` or `lg:grid-cols-3` for feature grids
- `gap-3` to `gap-6` between cards (consistent per page)

### Spacing Scale

- Component internal padding: `p-3` to `p-4`
- Section gaps: `gap-4` to `gap-8`
- Page padding: `px-4 md:px-6 py-6`
- Between major sections: `mt-8` to `mt-12`

### Shell Architecture

```
┌──────────────────────────────────────────────┐
│  AppHeader (h-14, fixed top, backdrop-blur)   │
├──────────┬───────────────────┬───────────────┤
│ Sidebar  │   Main Content    │  ChatSidebar  │
│ (w-64)   │   (scrollable)    │  (w-80)       │
│ lg+ only │                   │  on-demand    │
├──────────┴───────────────────┴───────────────┤
│  BottomBar (h-16, md:hidden, fixed bottom)    │
├──────────────────────────────────────────────┤
│  FloatingPlayer (conditional, above bottom)   │
└──────────────────────────────────────────────┘
```

- Header: `bg-surface-dim/95 backdrop-blur-md border-b border-outline-variant/10`
- Sidebar: `hidden lg:flex` left-fixed, `bg-surface-container-low`
- Bottom bar: `md:hidden`, `bg-surface-container-low`, safe-area-inset support
- Main content padding accounts for player presence: `calc(64px + 56px + env(safe-area-inset-bottom))`
- Chat sidebar slides in from right: `animate-in slide-in-from-right duration-200`

### Responsive Breakpoints

| Breakpoint | Width | Key Changes |
|------------|-------|-------------|
| Base (mobile) | < 640px | Single column, bottom bar visible, header compact |
| `sm` | 640px | Flex-row buttons, increased gaps |
| `md` | 768px | Bottom bar hidden, grid-cols-2, text scales up |
| `lg` | 1024px | Sidebar appears, header nav pills visible, grid-cols-3 |
| `xl` | 1280px | Full nav labels visible in header |

---

## 6. Motion & Interaction

### Easing Presets (Framer Motion)

| Name | Value | Usage |
|------|-------|-------|
| `smooth` | `[0.25, 0.1, 0.25, 1]` | Default entrance/exit, page transitions |
| `snappy` | `[0.19, 1, 0.22, 1]` | Quick interactions, scale-in |
| `bounce` | `[0.34, 1.56, 0.64, 1]` | Playful entrances (used sparingly) |

### Animation Variants

| Variant | Motion | Duration | Usage |
|---------|--------|----------|-------|
| `fadeUp` | opacity 0 → 1, y: 12 → 0 | 0.35s | List items, card entrances |
| `fadeIn` | opacity 0 → 1 | 0.3s | General fade-in |
| `scaleIn` | opacity 0 → 1, scale 0.95 → 1 | 0.25s | Modals, popovers |
| `stagger` | staggerChildren: 0.05s, delayChildren: 0.05s | — | List container orchestration |
| `PageTransition` | opacity 0 → 1, y: 8 → 0 | 0.3s | Route-level transition |

### Interactive Components

| Component | Hover | Tap/Press |
|-----------|-------|-----------|
| `AnimatedCard` | y: -2 (lift), 0.2s smooth | scale: 0.985 (press) |
| Primary button | `brightness-110` | — |
| Card border | `border-outline-variant/30` (from /10) | — |
| Feature card | `border-primary/20 shadow-lg shadow-primary/5` | — |
| Cover art | Play overlay `bg-black/40` fades in | — |

### CSS Animations

| Animation | Duration | Usage |
|-----------|----------|-------|
| `shimmer` | 1.5s ease-in-out infinite | Skeleton loading |
| `marquee` | 28s linear infinite (pauses on hover) | Feed showcase carousel |
| `blink` | 1s linear infinite (50% opacity) | Terminal cursor effect |
| `spin` | 3s linear infinite | Vinyl disc skeleton loader |

### Accessibility

- `prefers-reduced-motion: reduce` — disables ALL animations (duration → 0.01ms, iteration → 1)
- Applied globally in `globals.css` covering: grain, shimmer, blink, and all `*` transitions

---

## 7. Special Visual Effects

### Grain Texture Overlay

Applied via `.grain` class on body wrapper. Fixed SVG noise filter (`fractalNoise`, baseFrequency 0.9, 4 octaves) as `::after` pseudo-element at `opacity: 0.025` with `pointer-events: none` and `z-index: 50`. Adds analog film grain to the entire app.

### Glassmorphism

Header uses `backdrop-blur-md` with `bg-surface-dim/95` for frosted glass effect. Feature cards on landing page use `backdrop-blur-sm` with semi-transparent backgrounds.

### Edge Fade Mask

Feed showcase uses CSS `maskImage` gradient: `linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)` to fade edges of the scrolling marquee.

### Dotted Background

Landing page hero uses SVG-based dot pattern: 1px circles at 32px grid spacing, colored with `on-surface-variant` at low opacity.

---

## 8. Gamification Visual Language

### Rank System

| Rank Title | Min Score | Display Pattern |
|------------|-----------|-----------------|
| Vinyl Rookie | 0 | `font-mono text-xs text-on-surface-variant` |
| Crate Digger | 51 | Same styling, higher prestige |
| Wax Prophet | 201 | Same styling, higher prestige |
| Record Archaeologist | 501 | Same styling, highest prestige |

Score formula: `globalScore = rarityScore * 0.7 + contributionScore * 0.3`

### Badge Pills

```
font-mono text-[9px] text-primary/70 bg-primary/8 border border-primary/12
px-1.5 py-0.5 rounded
```

Show up to 4 inline on profile, with `+N more` overflow indicator.

### 6 Milestone Badges

`first_dig`, `century_club`, `rare_find`, `critic`, `connector`, `crew_member`

---

## 9. Terminal UI Language

The defining aesthetic choice. Data-facing UI elements use terminal conventions:

- **Status labels**: `[DIGGING_TRIP]`, `[WISH_LIST]`, `[OTHER]` — bracket + underscore format
- **Empty states**: `[NO_MATCHES]`, `[NO_NOTIFICATIONS]` — centered, mono, muted
- **Pagination**: `← PREV` / `NEXT →` — ASCII arrows, mono, text-xs
- **Filter chips**: `[LABEL]` format with border states
- **Section headers**: `font-mono text-xs tracking-[0.2em] uppercase` — wide-tracked micro labels
- **Logo**: `DIG` in primary + `SWAP` in on-surface — split-color mono treatment

This terminal language is used **only for navigation, labels, and data display** — never for body content or long-form text.

---

## 10. Design Rules for Generation

When generating new screens or components for DigSwap:

1. **Always dark mode.** There is no light mode. All 4 themes are dark.
2. **Use semantic tokens, never raw hex.** Write `bg-primary` not `bg-[#6fdd78]`. The only exceptions are Premium Gold (`#c8914a`) and showcase accents.
3. **Monospace for data, headings for titles, sans for body.** Never mix these roles.
4. **Rarity colors follow the 3-tier system.** Primary = Common, Secondary = Rare, Tertiary = Ultra Rare. This is non-negotiable.
5. **Cards use surface-container-low** with `border-outline-variant/10`. Hover raises to `/30`.
6. **Buttons get `shadow-primary/20`** glow on primary variant. No other shadow colors on CTAs.
7. **Icons are Material Symbols Outlined.** No Lucide icons in custom components (shadcn/ui uses Lucide internally, that's fine).
8. **Grain overlay is always present.** The `.grain` wrapper is on the root — never remove it.
9. **Terminal bracket notation** for status/empty/pagination labels. Always mono, always uppercase.
10. **New pages respect the max-width convention.** Check the table above for the correct width per page type.
11. **Motion is entrance-only.** Use `fadeUp` for lists, `PageTransition` for routes. No looping animations except shimmer/marquee/blink.
12. **Opacity layering**: `/10` for subtle backgrounds, `/20` for borders, `/30` for hover borders, `/40` for overlays, `/95` for glass.

---

## 11. Anti-Patterns

Do NOT:

- Use light backgrounds or light themes
- Use colors outside the semantic token system
- Put body text in monospace or headings in sans
- Use emoji in UI labels (terminal aesthetic uses text/icons only)
- Create 50/50 symmetric layouts for hero sections (asymmetry preferred)
- Add border-radius beyond `rounded-xl` on cards (no `rounded-3xl` or larger)
- Use `animate-bounce` or attention-seeking animations
- Mix icon libraries (no Font Awesome, no Heroicons alongside Material Symbols)
- Use inline styles for colors (always Tailwind classes with semantic tokens)
- Create components that don't respect theme switching (test in all 4 themes)
- Use white (`#fff`) or pure black (`#000`) — always use token equivalents
