---
type: quick
autonomous: true
files_modified:
  - previews/profile-redesign-preview.html
---

<objective>
Create a standalone HTML concept preview for the DigSwap profile redesign before changing the real application code.

The preview should make the proposed hierarchy visible in two states:
- public profile: action-first, compatibility-first
- my profile: identity + momentum + management
</objective>

<context>
Current implementation reviewed in:
- apps/web/src/app/(protected)/(profile)/perfil/page.tsx
- apps/web/src/app/(protected)/(profile)/perfil/_components/profile-hero.tsx
- apps/web/src/app/(protected)/(profile)/perfil/_components/about-tab.tsx
- apps/web/src/app/perfil/[username]/page.tsx
- apps/web/src/app/perfil/[username]/_components/profile-header.tsx
- apps/web/src/app/perfil/[username]/_components/profile-collection-section.tsx

Core redesign goals from the audit:
- reduce hero density
- move action and overlap higher in the page
- preserve DigSwap personality
- push deep modules below the fold
- make the public profile feel as premium as the owner profile
</context>

<tasks>
1. Build a polished standalone HTML file under previews/ with internal CSS and lightweight JS only.
2. Show both public and owner profile states with a clear visual switch.
3. Highlight the intended hierarchy changes so the preview can be approved before implementation.
</tasks>

<success_criteria>
- The preview is easy to open directly as a local HTML file.
- The visual direction is clearly more premium, more legible, and more action-oriented than the current page.
- No production app files are changed yet.
</success_criteria>
