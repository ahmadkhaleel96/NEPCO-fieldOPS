import { describe, it, expect } from 'vitest';
import {
  StartTripSchema,
  PostTripLocationsSchema,
  SiteArrivalSchema,
  TripSchema,
  NfcEventSchema,
  NfcEventTypeSchema,
  TripTrackResponseSchema,
} from '../schemas/trip.schema';

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const nowIso = () => new Date().toISOString();

describe('NfcEventTypeSchema', () => {
  it('accepts all valid event types', () => {
    for (const t of ['vehicle_start', 'site_arrival', 'trip_end', 'permit_withdrawal']) {
      expect(() => NfcEventTypeSchema.parse(t)).not.toThrow();
    }
  });

  it('rejects unknown event type', () => {
    expect(() => NfcEventTypeSchema.parse('unknown_event')).toThrow();
  });
});

describe('StartTripSchema', () => {
  const valid = {
    tag_id: 'TAG-VEH-001',
    permit_id: uuid(1),
    lat: 31.9454,
    lng: 35.9284,
    client_id: uuid(2),
    client_timestamp: nowIso(),
  };

  it('accepts a valid trip start payload', () => {
    expect(() => StartTripSchema.parse(valid)).not.toThrow();
  });

  it('rejects an empty tag_id', () => {
    expect(StartTripSchema.safeParse({ ...valid, tag_id: '' }).success).toBe(false);
  });

  it('rejects an invalid permit_id', () => {
    expect(StartTripSchema.safeParse({ ...valid, permit_id: 'bad' }).success).toBe(false);
  });

  it('rejects coordinates out of range', () => {
    expect(StartTripSchema.safeParse({ ...valid, lat: 91 }).success).toBe(false);
    expect(StartTripSchema.safeParse({ ...valid, lng: 200 }).success).toBe(false);
  });

  it('rejects non-UUID client_id', () => {
    expect(StartTripSchema.safeParse({ ...valid, client_id: 'not-uuid' }).success).toBe(false);
  });
});

describe('PostTripLocationsSchema', () => {
  const makePoint = (n: number) => ({
    lat: 31.9 + n * 0.001,
    lng: 35.9 + n * 0.001,
    captured_at: nowIso(),
    client_id: uuid(n),
  });

  it('accepts a valid batch of locations', () => {
    expect(() =>
      PostTripLocationsSchema.parse({ locations: [makePoint(1), makePoint(2)] })
    ).not.toThrow();
  });

  it('rejects an empty locations array', () => {
    expect(PostTripLocationsSchema.safeParse({ locations: [] }).success).toBe(false);
  });

  it('rejects a batch of more than 20 points', () => {
    const points = Array.from({ length: 21 }, (_, i) => makePoint(i));
    expect(PostTripLocationsSchema.safeParse({ locations: points }).success).toBe(false);
  });

  it('accepts up to 20 points', () => {
    const points = Array.from({ length: 20 }, (_, i) => makePoint(i));
    expect(() => PostTripLocationsSchema.parse({ locations: points })).not.toThrow();
  });
});

describe('SiteArrivalSchema', () => {
  const valid = {
    tag_id: 'TAG-HVT-042',
    trip_id: uuid(1),
    lat: 31.9454,
    lng: 35.9284,
    client_id: uuid(2),
    client_timestamp: nowIso(),
  };

  it('accepts a valid site arrival', () => {
    expect(() => SiteArrivalSchema.parse(valid)).not.toThrow();
  });

  it('rejects invalid trip_id', () => {
    expect(SiteArrivalSchema.safeParse({ ...valid, trip_id: 'bad' }).success).toBe(false);
  });
});

describe('TripSchema', () => {
  const validTrip = {
    id: uuid(1),
    permit_id: uuid(2),
    driver_id: uuid(3),
    vehicle_id: uuid(4),
    start_time: '2026-06-01T08:00:00.000Z',
    end_time: null,
    start_lat: 31.9454,
    start_lng: 35.9284,
    end_lat: null,
    end_lng: null,
    client_id: uuid(5),
    created_at: '2026-06-01T08:00:00.000Z',
  };

  it('parses a valid in-progress trip', () => {
    const result = TripSchema.parse(validTrip);
    expect(result.end_time).toBeNull();
  });

  it('parses a completed trip with end coordinates', () => {
    const result = TripSchema.parse({
      ...validTrip,
      end_time: '2026-06-01T16:00:00.000Z',
      end_lat: 31.96,
      end_lng: 35.95,
    });
    expect(result.end_time).toBe('2026-06-01T16:00:00.000Z');
  });
});

describe('TripTrackResponseSchema', () => {
  it('accepts a valid GeoJSON LineString', () => {
    expect(() =>
      TripTrackResponseSchema.parse({
        type: 'LineString',
        coordinates: [
          [35.9284, 31.9454],
          [35.9300, 31.9470],
        ],
        has_gaps: false,
      })
    ).not.toThrow();
  });

  it('rejects wrong GeoJSON type', () => {
    expect(
      TripTrackResponseSchema.safeParse({
        type: 'Point',
        coordinates: [[35.9284, 31.9454]],
        has_gaps: false,
      }).success
    ).toBe(false);
  });
});
