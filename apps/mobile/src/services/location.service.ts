/**
 * Location service — GPS tracking for active trips.
 *
 * Batches points locally and flushes to the API every FLUSH_INTERVAL_MS.
 * Points are stored in memory; if the flush fails they are retried on the
 * next interval (offline-first design).
 *
 * Platform notes:
 *   iOS  : requires NSLocationAlwaysAndWhenInUseUsageDescription + background location entitlement
 *   Android: requires ACCESS_BACKGROUND_LOCATION permission
 */

import * as Location from 'expo-location';
import type { TripLocationPoint } from '@fieldops/api-client';
import { apiClient } from '../lib/api';

export interface LocationPoint {
  lat: number;
  lng: number;
  accuracy: number | undefined;
  captured_at: string;
  client_id: string;
}

const FLUSH_INTERVAL_MS = 15_000;
const BATCH_SIZE = 20;

let _subscription: Location.LocationSubscription | null = null;
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _queue: LocationPoint[] = [];
let _activeTripId: string | null = null;

/**
 * Request foreground + background location permissions.
 * Returns true if both are granted.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  return bg === 'granted';
}

/**
 * Start GPS tracking for the given trip.
 * Points are collected and flushed to POST /trips/:id/locations in batches.
 */
export async function startTracking(tripId: string): Promise<void> {
  if (_subscription) return; // already tracking

  const granted = await requestLocationPermissions();
  if (!granted) {
    throw new Error('Location permission not granted');
  }

  _activeTripId = tripId;
  _queue = [];

  _subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5_000,
      distanceInterval: 10,
    },
    (loc) => {
      _queue.push({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? undefined,
        captured_at: new Date(loc.timestamp).toISOString(),
        client_id: crypto.randomUUID(),
      });
    }
  );

  _flushTimer = setInterval(() => {
    void flushQueue();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Stop GPS tracking and flush any remaining queued points.
 */
export async function stopTracking(): Promise<void> {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  if (_subscription) {
    _subscription.remove();
    _subscription = null;
  }
  await flushQueue();
  _activeTripId = null;
}

/**
 * Flush up to BATCH_SIZE queued points to the API.
 * Silently retains points on network failure so they are retried.
 */
async function flushQueue(): Promise<void> {
  if (!_activeTripId || _queue.length === 0) return;

  const batch = _queue.splice(0, BATCH_SIZE);
  const payload: TripLocationPoint[] = batch.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    accuracy: p.accuracy,
    captured_at: p.captured_at,
    client_id: p.client_id,
  }));

  try {
    await apiClient.trips.postLocations(_activeTripId, { locations: payload });
  } catch {
    // Re-queue on failure (offline-first)
    _queue.unshift(...batch);
  }
}

/** Returns the number of GPS points currently waiting to be flushed. */
export function getPendingCount(): number {
  return _queue.length;
}

/** Returns true if the service is currently tracking. */
export function isTracking(): boolean {
  return _subscription !== null;
}
