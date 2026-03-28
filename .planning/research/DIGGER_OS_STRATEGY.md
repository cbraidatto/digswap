# DigSwap Digger OS Strategy

**Status:** Working strategy draft  
**Created:** 2026-03-28  
**Purpose:** Consolidate the proposal, discussion, critique, and research from this thread into one internal reference.

## 1. What This Document Is Trying To Clarify

DigSwap already has a strong raw idea: a vinyl digger opens the app and quickly finds who has the record they have been hunting. The problem is not the absence of value. The problem is that the value is currently spread across too many narratives at once.

This document captures the conclusion of our discussion:

- DigSwap should not be positioned primarily as "a social network for vinyl collectors"
- DigSwap should not be positioned primarily as "a place to trade audio rips"
- DigSwap is strongest when framed as the operating system for serious diggers

That means the product should win on workflow, context, memory, trust, and scene participation before it tries to win on generic social features.

## 2. Core Project Reality

These constraints are not side notes. They define what DigSwap can and should become.

- Solo developer: every major feature must stay maintainable by one person
- Web first: the product must feel excellent in the browser before anything else
- English first: the market is global, even if internal planning happens in another language
- Discogs is the identity and data foundation: import, collection context, wantlist context, and metadata legitimacy all matter
- P2P is WebRTC only: files never touch the server, which is both a legal and architectural non-negotiable
- Trust is a product feature: security, integrity, and reputation are not backend polish; they are part of the core value

## 3. Honest Critique Of The Current Direction

### 3.1 The product is trying to sell three different things at once

Right now DigSwap can be read as:

- a social network for vinyl collectors
- a Discogs-adjacent collection/discovery utility
- a P2P rip-trading app

That creates confusion. The wider the story becomes, the weaker the promise feels.

### 3.2 "Social network for vinyl collectors" is too broad

It sounds nice, but it does not explain why someone would change behavior. The serious digger already has a stack:

- Discogs for data and wantlists
- Instagram for identity and showing off finds
- WhatsApp, Discord, or DMs for direct contact
- sometimes Soulseek or private circles for harder-to-find material

If DigSwap is just "another social network," it will lose before the comparison even starts.

### 3.3 Leading with P2P is strategically weak

Even if the architecture is legally cautious and technically elegant, "trade audio rips" is still a bad headline. It immediately triggers questions about legality, trust, and platform risk. It is better as an advanced capability inside a trusted collector network than as the core public story.

### 3.4 A feed-first product misunderstands the best user

Professional or highly committed diggers are not opening an app because they want a generic feed. They open it because they want to:

- find something
- compare something
- follow a lead
- message the right person
- save context for later
- watch a scene, label, or group of users

In other words, the primary mode is not passive scrolling. It is active digging.

### 3.5 Gamification can help or cheapen the brand

Gamification is useful only if it reinforces identity, trust, and contribution. If it feels like points for points' sake, the product starts to look casual and unserious. Serious diggers want status, but they want status that means something.

## 4. Strategic Repositioning

### 4.1 The strongest category

DigSwap should be repositioned as:

**The operating system for serious diggers.**

Or, more plainly:

**The place where serious diggers search, compare, track leads, build trust, and find their people.**

### 4.2 What the product should promise

The main promise should be workflow superiority:

- better search than social platforms
- better people discovery than Discogs
- better memory than chat apps
- better trust signals than informal DMs

### 4.3 What stays secondary

These can still exist, but they should not lead the story:

- generic social feed
- gamification as a headline
- P2P transfer as the main reason to join
- "community for everyone" language

### 4.4 Positioning lines worth exploring

- Find records. Find owners. Find your people.
- The serious digging network.
- Your Discogs library, turned into discovery.
- Search deeper. Track better. Connect smarter.

## 5. The Central Product Thesis: Digger OS

The strongest long-term idea is not a feed, a marketplace, or a transfer tool. It is a **Digger OS**: a system that supports the entire digging workflow.

The product should help users do six things better than they currently do across fragmented tools:

1. search
2. identify the right people
3. preserve memory and context
4. move inside scenes and circles
5. evaluate trust
6. act on opportunities

## 6. The Digger Workflow

If DigSwap is built for serious diggers, it should map to the real sequence of behavior:

1. A user hunts for a record, artist, label, scene, or style.
2. They filter for relevance: who owns it, where they are, how serious they are, what else they collect.
3. They inspect the context around the result: collection, wantlist, overlap, taste, circles, activity.
4. They save the lead and attach memory to it.
5. They return later through alerts, room activity, or saved searches.
6. They interact: follow, compare, request, trade, or join the same scene.
7. They build long-term reputation through contribution and reliability.

The winning product is the one that makes this loop feel natural and repeatable.

## 7. What Soulseek Teaches

Soulseek matters here not because DigSwap should imitate its legal framing or interface, but because Soulseek still understands how serious music people work.

Its lasting strengths come from combining:

- search
- browse
- chat
- memory
- circles
- status

That combination creates habit.

### 7.1 Patterns worth adapting

| Soulseek pattern | Why it works | DigSwap adaptation |
|---|---|---|
| Search by scope | Users do not always want global search; sometimes they want "my people" or "this room" | Search scopes such as global, people I follow, my circles, this room, owners of this label, matches to my wantlist |
| Browse from a result into a person | The result is not the end; it is the doorway into context | Every result should lead into a person, collection, wantlist overlap, and taste context |
| Wishlist and alerts | Serious users run persistent hunts over time | Saved searches, named hunts, alerts for new owners and new overlaps |
| User notes | Serious collectors need memory, not just messaging | Private notes on users, labels, releases, and rooms |
| Private rooms and scene spaces | Micro-scenes matter more than generic communities | Public and private circles by style, scene, city, label, or collector niche |
| Persistent room wall | Valuable discussion should not vanish in chat flow | Room walls, pinned lists, reference posts, and scene boards |
| User status signals | People want to know who is active and reliable | Response rate, trade completion rate, trust badges, activity recency |
| Privileges | Power users will pay or contribute for sharper tools | Pro Digger features that increase search power, alert depth, and workflow efficiency |

### 7.2 What not to copy

- chaotic UX
- ugly information overload
- legal framing centered on file exchange
- status based purely on volume
- giant contextless rooms
- hostile gatekeeping culture

The lesson is to copy the workflow intelligence, not the rough edges.

## 8. The Product Proposal: Six Layers Of Digger OS

### 8.1 Search OS

This should be the real heart of the app.

- search by release, artist, label, catalog number, country, year, genre, style, format, city, user, circle
- support scoped search: global, following, circles, room, label owners, wantlist matches
- allow saved searches and named hunts
- add alerts for new owners, new wants, and newly relevant users
- show reasons why a result matters, not just that it exists

### 8.2 People Graph

Results should lead to people, not dead ends.

- who owns this
- who wants this
- who has strong overlap with my taste
- who is connected to this scene or label
- who is trusted by people I trust

Key experiences:

- collection comparison
- wantlist comparison
- overlap by label, era, style, country
- discover similar diggers through intentional physical collections

### 8.3 Digger Memory

This is one of the biggest gaps in existing tools.

Diggers constantly build private context that gets lost across chats, screenshots, notes apps, and browser tabs.

DigSwap should support:

- private notes on users
- private notes on releases and labels
- lead tracking
- searchable interaction history
- personal boards for active hunts
- records of where a lead came from

If DigSwap remembers the hunt better than WhatsApp and browser bookmarks do, it becomes sticky.

### 8.4 Scene Graph

Community should be structured around scenes, not generic "social."

- public rooms for broad discovery
- private circles for trust-heavy communities
- scene walls with persistent context
- lists, discussions, and posts attached to specific records, labels, or hunts
- less generic feed, more contextual conversation

The point is not to create a fake mass social network. It is to create meaningful density in small circles.

### 8.5 Trust Layer

Trust is not an add-on. It is one of the product's reasons to exist.

Important trust primitives:

- response rate
- trade completion rate
- review quality
- long-term contribution
- "trusted by" signals
- account maturity and collection credibility
- clear separation between popularity and reliability

This layer also has a technical implication: security flaws that undermine trade integrity or reputation integrity are product problems, not just engineering problems.

### 8.6 Pro Digger Layer

There should eventually be an advanced mode for power users.

- more alerts
- faster or deeper search workflows
- advanced compare tools
- dashboards for demand and overlap
- scene or label intelligence
- specialty-based rankings
- premium research utilities

This can support monetization later, but it should first reinforce identity: "this is the serious tool."

## 9. Messaging And Category Design

### 9.1 Recommended primary message

DigSwap is where serious diggers:

- find records
- find owners
- track leads
- build trust
- build scene presence

### 9.2 What not to say first

- "social network for vinyl collectors"
- "trade audio rips"
- "gamified app for record collectors"

Those are either too broad, too risky, or too weak as category-defining language.

### 9.3 Safer and stronger category framing

- serious digging network
- collector discovery platform
- digging workflow platform
- Discogs-powered discovery and trust layer

## 10. ICP: Who This Should Really Be For

Do not target "vinyl collectors" as a giant category.

The sharper ICP is:

- DJs and selectors
- Discogs-heavy collectors
- users with active wantlists
- people who already use multiple tools to dig
- people who care about rarity, taste, context, and access

This user does not want more noise. They want an advantage.

## 11. Go-To-Market Implications

The product should not launch as "for everyone who likes records."

The stronger move is:

- choose one micro-scene
- seed the platform with respected users
- concierge the onboarding
- make profiles, comparisons, and searches feel dense from day one
- create private circles early
- use invite-driven trust before scale-driven openness

In practice, that means winning one collector community at a time, not trying to become a mainstream network immediately.

## 12. Product Decisions This Strategy Implies

### 12.1 Home should become search-first, not feed-first

The feed can still matter, but the first experience for the target user should feel like the start of a hunt.

### 12.2 Posts should be contextual

The best social objects are not generic text posts. They are objects like:

- a release
- a label
- a comparison
- a list
- a wantlist lead
- a room discussion

### 12.3 Reputation must feel earned

Badges and ranks should reflect taste, contribution, and reliability. They should not feel like cheap rewards.

### 12.4 P2P should be integrated into trust, not marketed as the app itself

P2P is strongest as a late-stage action inside a relationship and discovery system.

## 13. Strategic Risks

### 13.1 Perception risk

If the market reads DigSwap as "the rip-sharing app," the product loses credibility with serious collectors, creators, media, and possible partners.

### 13.2 Network-effect risk

If the app is empty or vague, users will bounce immediately. Single-player utility and guided dense communities are critical.

### 13.3 Scope risk

The Digger OS vision is powerful, but it can also become a trap if everything is built at once. The system should be layered carefully.

### 13.4 Trust risk

Because the product is built on discovery and reputation, the underlying system has to protect trade integrity, review integrity, ranking integrity, and peer verification. If those fail, the product story collapses.

## 14. What This Means For Future Roadmap Decisions

The next layers worth prioritizing are:

1. search-first UX refinement
2. richer comparison and people context
3. saved hunts and alerts
4. private notes and Digger Memory
5. circles and scene walls
6. stronger trust signals

This sequence is more aligned with the Digger OS thesis than a generic expansion of feed mechanics.

## 15. Final Strategic Conclusion

DigSwap is most defensible when it becomes better than the current fragmented workflow:

- better than Discogs at people discovery
- better than Instagram at context
- better than WhatsApp at memory
- better than informal circles at trust

That is the real opportunity.

The project should aim to become the home of serious diggers, not by trying to be everything at once, but by becoming the best place to hunt, compare, remember, connect, and build reputation.

## 16. Source Notes

This strategy was informed by a mix of project context, product critique, and targeted external research on Soulseek, Discogs, and music discovery behavior.

Primary references:

- [Soulseek changelog](https://www.slsknet.org/news/changelog)
- [Soulseek: search by room and user list](https://www.slsknet.org/news/node/668)
- [Soulseek: private rooms](https://www.slsknet.org/news/node/357)
- [Soulseek: user notes](https://www.slsknet.org/news/node/429)
- [Soulseek FAQ](https://www.slsknet.org/news/faq-page)
- [Soulseek rules](https://www.slsknet.org/news/node/681)
- [Soulseek privileges](https://www.slsknet.org/qtlogin.php)
- [Soulseek: direct search delivery](https://www.slsknet.org/news/node/699)
- [Discogs: wantlist](https://support.discogs.com/hc/en-us/articles/360007331594-How-Does-The-Wantlist-Feature-Work)
- [Discogs: lists](https://support.discogs.com/hc/en-us/articles/360001567973-How-To-Make-A-List)
- [Discogs: collection notes](https://support.discogs.com/hc/en-us/articles/360007331674-Customizing-Your-Collection-Notes)
- [Discogs: private messages](https://support.discogs.com/hc/en-us/articles/360007426293-How-Does-The-Discogs-Private-Message-System-Work)
- [Discogs: friends](https://support.discogs.com/hc/en-us/articles/360010778358-Friends-Feature-On-The-Android-App)
- [Social interactions affect discovery processes](https://arxiv.org/abs/2202.05099)
- [Support the underground: characteristics of beyond-mainstream music listeners](https://link.springer.com/article/10.1140/epjds/s13688-021-00268-9)
- [Record Collecting as a Focal Practice](https://academic.oup.com/bjaesthetics/article-abstract/66/1/73/8176726)
