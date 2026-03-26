# Phase 7: Community + Reviews — Discussion Log

**Date:** 2026-03-26
**Format:** Interactive discuss-phase session

---

## Areas Discussed

All four gray areas selected by user.

---

## Community Landing Page

**Q: What does /comunidade become in Phase 7?**
Options: Group discovery hub / My Groups dashboard / Replace current tabs
**Selected:** Group discovery hub
Notes: Genre groups at top always visible, user-created groups below, [+ CREATE_GROUP] button.

**Q: When a user clicks a group, where do they go?**
Options: /comunidade/[slug] / /comunidade/[id] with UUID
**Selected:** /comunidade/[slug]
Notes: Slug-based URL, clean deep-link.

---

## Group Feed & Posts

**Q: Visual style for posts inside a group feed?**
Options: Simpler than main feed / Same Ghost Protocol cards / Minimal text-only
**Selected:** Simpler than main feed
Notes: Author + timestamp header, text body, compact linked record reference, separator line.

**Q: How does a user link a record to their post?**
Options: Search-while-composing / Paste Discogs URL / Optional, Claude decides
**Selected:** Search-while-composing
Notes: [+ link record] button opens Phase 6 record search. Needs groupPosts.release_id migration.

**Q: Does posting in a group also appear in the main activity feed?**
Options: Yes — group posts feed the main feed / No — group posts stay in-group only
**Selected:** Yes — group posts feed the main feed
Notes: Visible to followers who are also group members. group_post event type added.

---

## Reviews Surface

**Q: Where does a user write a review?**
Options: Inside a group (special post type) / From a record detail page / Both
**Selected:** Inside a group, review is a special post type
Notes: Same composer, star rating + mandatory linked record. Visually distinct with star rating in header.

**Q: Where does 'browse all reviews for any pressing/release' live?**
Options: On each record's search card / Dedicated /records/[id] page / Reviews tab on /explorar
**Selected:** On each record's search card
Notes: reviews: N count expands inline on RecordSearchCard. No new route.

**Q: Star rating: 5 stars or half-stars?**
Options: 5 whole stars / Half-stars (0.5 increments)
**Selected:** 5 whole stars
Notes: Matches existing DB schema (integer field).

---

## Private Groups

**Q: How are private groups discovered (if at all)?**
Options: Visible but locked / Completely hidden / Claude decides
**Selected:** Visible but locked
Notes: [PRIVATE] badge, name + member count visible, feed hidden, no join button.

**Q: How does a user get invited to a private group?**
Options: Invite by username / Shareable invite link / Both
**Selected:** Both
Notes: Username invite via in-app notification (Phase 6 system) + shareable /join/[token] link.
