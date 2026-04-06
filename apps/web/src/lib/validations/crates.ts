import { z } from "zod";

export const createCrateSchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  sessionType: z.enum(["digging_trip", "event_prep", "wish_list", "other"]),
});

export const updateCrateSchema = createCrateSchema
  .partial()
  .extend({ id: z.string().uuid() });

export const addToCrateSchema = z.object({
  crateId: z.string().uuid(),
  releaseId: z.string().uuid().nullable(),
  discogsId: z.number().int().nullable(),
  title: z.string().max(255).nullable(),
  artist: z.string().max(255).nullable(),
  coverImageUrl: z.string().url().nullable(),
});

export const crateItemIdSchema = z.object({
  crateItemId: z.string().uuid(),
});

export const createSetSchema = z.object({
  crateId: z.string().uuid(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .nullable(),
  venueName: z.string().max(200).nullable(),
  trackOrder: z.array(z.string().uuid()).min(1), // crateItemIds in display order
});

export const updateSetTracksSchema = z.object({
  setId: z.string().uuid(),
  trackOrder: z.array(z.string().uuid()).min(1),
});

export const crateIdSchema = z.object({
  crateId: z.string().uuid("Invalid crate ID"),
});

export const toggleCrateVisibilitySchema = z.object({
  crateId: z.string().uuid("Invalid crate ID"),
  isPublic: z.boolean(),
});

export const setIdSchema = z.object({
  setId: z.string().uuid("Invalid set ID"),
});
