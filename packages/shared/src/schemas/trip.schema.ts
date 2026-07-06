import { z } from 'zod';

export const NfcEventTypeSchema = z.enum([
  'vehicle_start',
  'site_arrival',
  'trip_end',
  'permit_withdrawal',
]);

export type NfcEventType = z.infer<typeof NfcEventTypeSchema>;

/** Posted by mobile on vehicle NFC scan */
export const StartTripSchema = z.object({
  tag_id: z.string().min(1, 'Tag ID is required'),
  permit_id: z.string().uuid('Invalid permit ID'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  client_id: z.string().uuid('client_id must be a valid UUID'),
  client_timestamp: z.string().datetime(),
});

export type StartTrip = z.infer<typeof StartTripSchema>;

/** Batch GPS points — sent in groups of 10 to reduce requests */
export const TripLocationPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  captured_at: z.string().datetime(),
  client_id: z.string().uuid(),
});

export type TripLocationPoint = z.infer<typeof TripLocationPointSchema>;

export const PostTripLocationsSchema = z.object({
  locations: z
    .array(TripLocationPointSchema)
    .min(1)
    .max(20, 'Maximum 20 points per batch'),
});

export type PostTripLocations = z.infer<typeof PostTripLocationsSchema>;

/** Posted on site arrival NFC scan */
export const SiteArrivalSchema = z.object({
  tag_id: z.string().min(1),
  trip_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  client_id: z.string().uuid(),
  client_timestamp: z.string().datetime(),
});

export type SiteArrival = z.infer<typeof SiteArrivalSchema>;

export const TripSchema = z.object({
  id: z.string().uuid(),
  permit_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().nullable(),
  start_lat: z.number(),
  start_lng: z.number(),
  end_lat: z.number().nullable(),
  end_lng: z.number().nullable(),
  client_id: z.string().uuid(),
  created_at: z.string().datetime(),
});

export type Trip = z.infer<typeof TripSchema>;

export const NfcEventSchema = z.object({
  id: z.string().uuid(),
  tag_id: z.string(),
  event_type: NfcEventTypeSchema,
  trip_id: z.string().uuid().nullable(),
  permit_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  client_id: z.string().uuid(),
  client_timestamp: z.string().datetime(),
  created_at: z.string().datetime(),
});

export type NfcEvent = z.infer<typeof NfcEventSchema>;

/** GeoJSON LineString for map rendering */
export const TripTrackResponseSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
  has_gaps: z.boolean(),
});

export type TripTrackResponse = z.infer<typeof TripTrackResponseSchema>;
