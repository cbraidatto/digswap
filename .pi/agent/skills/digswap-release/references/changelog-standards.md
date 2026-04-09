# Changelog Standards

## Conventional Commits

All commits in DigSwap follow the conventional commits format:

```
type(scope): description
```

Types used in this project:

| Type       | When                                           |
|------------|------------------------------------------------|
| `feat`     | New feature or capability                      |
| `fix`      | Bug fix                                        |
| `docs`     | Documentation changes (plans, READMEs, specs)  |
| `refactor` | Code restructuring without behavior change     |
| `test`     | Adding or updating tests                       |
| `chore`    | Build, tooling, dependency, or config changes  |
| `perf`     | Performance improvements                       |
| `security` | Security fixes or hardening                    |

Scope is typically the phase number (e.g., `feat(24)`) or domain area (e.g., `fix(auth)`, `refactor(trade-domain)`).

## Generating Changelog

Generate changelog entries from git history since the last release tag:

```bash
# List commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# If no tags exist yet (first release)
git log --oneline
```

Group commits into changelog sections manually or with a script. Do not blindly copy git log output — curate it for humans.

## CHANGELOG.md Format

Maintain a `CHANGELOG.md` at the project root using Keep a Changelog format:

```markdown
# Changelog

## [v1.1.0] - 2026-04-10

### Added
- Collection comparison between users (#PR)
- Gem badge system with rarity tiers (#PR)

### Changed
- Improved search performance with debounced queries (#PR)

### Fixed
- Profile page crash when user has no collections (#PR)

### Security
- CSP headers hardened for production deployment (#PR)

### Removed
- Deprecated legacy import endpoint (#PR)
```

## Sections

| Section    | What goes here                                  |
|------------|------------------------------------------------|
| Added      | New features, pages, components, integrations   |
| Changed    | Modifications to existing behavior              |
| Fixed      | Bug fixes                                       |
| Removed    | Removed features, deprecated code cleanup       |
| Security   | Vulnerability fixes, hardening, dependency patches |

## Rules

- Write entries from the user's perspective, not the developer's. "Added gem badges for collection rarity" not "Implemented GemBadge component."
- Link to PRs when available.
- Date format: ISO 8601 (YYYY-MM-DD).
- Unreleased changes go under an `## [Unreleased]` heading until tagged.
- Never edit entries for already-released versions.
