/**
 * Discogs action validations.
 *
 * The Discogs server actions (connectDiscogs, triggerSync, disconnectDiscogs,
 * triggerReimport) accept no user input beyond the authenticated session.
 * No Zod schemas are needed — authentication is the only gate.
 *
 * This file exists for documentation consistency with other validation modules.
 */
