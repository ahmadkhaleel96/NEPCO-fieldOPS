import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ApiClientWorkPermitDetail, ApiClientTrip } from '@fieldops/api-client';
import { apiClient } from '../../../src/lib/api';
import { scanNfcTag, isNfcSupported, NfcError } from '../../../src/services/nfc.service';
import { startTracking, stopTracking, isTracking, getCurrentPosition } from '../../../src/services/location.service';
import { Colors } from '../../../src/styles/colors';
import styles from './[id].styles';

export default function TripScreen() {
  const { id: permitId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [permit, setPermit] = useState<ApiClientWorkPermitDetail | null>(null);
  const [trip, setTrip] = useState<ApiClientTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPermit = useCallback(async () => {
    if (!permitId) return;
    try {
      const res = await apiClient.workPermits.get(permitId);
      setPermit(res.data);
    } catch {
      setError('Failed to load permit details.');
    } finally {
      setLoading(false);
    }
  }, [permitId]);

  useEffect(() => {
    void loadPermit();
    void isNfcSupported().then(setNfcSupported);
  }, [loadPermit]);

  // ── Start trip via vehicle NFC scan ──────────────────────────────────────

  async function handleStartTrip() {
    setScanning(true);
    setError(null);
    try {
      const [{ tag_id }, position] = await Promise.all([
        scanNfcTag(),
        getCurrentPosition(),
      ]);
      const res = await apiClient.trips.start({
        tag_id,
        permit_id: permitId!,
        lat: position.lat,
        lng: position.lng,
        client_id: crypto.randomUUID(),
        client_timestamp: new Date().toISOString(),
      });
      setTrip(res.data);
      await startTracking(res.data.id);
    } catch (err) {
      if (err instanceof NfcError) {
        setError(err.message);
      } else {
        setError('Failed to start trip. Please try again.');
      }
    } finally {
      setScanning(false);
    }
  }

  // ── Site arrival NFC scan ─────────────────────────────────────────────────

  async function handleSiteArrival() {
    if (!trip) return;
    setScanning(true);
    setError(null);
    try {
      const [{ tag_id }, position] = await Promise.all([
        scanNfcTag(),
        getCurrentPosition(),
      ]);
      await apiClient.nfcEvents.recordArrival({
        tag_id,
        trip_id: trip.id,
        lat: position.lat,
        lng: position.lng,
        client_id: crypto.randomUUID(),
        client_timestamp: new Date().toISOString(),
      });
      Alert.alert('Site arrival recorded', 'NFC scan logged successfully.');
    } catch (err) {
      if (err instanceof NfcError) {
        setError(err.message);
      } else {
        setError('Site arrival scan failed. Please try again.');
      }
    } finally {
      setScanning(false);
    }
  }

  // ── End trip ──────────────────────────────────────────────────────────────

  async function handleEndTrip() {
    if (!trip) return;
    Alert.alert('End Trip', 'Are you sure you want to end this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopTracking();
            await apiClient.trips.end(trip.id, {});
            router.replace('/(app)');
          } catch {
            setError('Failed to end trip. Please try again.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary600} testID="loading-indicator" />
      </View>
    );
  }

  if (!permit) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Permit not found.</Text>
      </View>
    );
  }

  const tripActive = trip !== null || isTracking();

  return (
    <ScrollView style={styles.container}>
      {/* Permit info card */}
      <View style={styles.infoCard}>
        <Text style={styles.permitNumber}>{permit.permit_number}</Text>
        <Text style={styles.permitType}>{permit.permit_type}</Text>
        <View style={styles.dateRow}>
          <View>
            <Text style={styles.dateLabel}>Start</Text>
            <Text style={styles.dateValue}>
              {new Date(permit.scheduled_start).toLocaleString()}
            </Text>
          </View>
          <View>
            <Text style={styles.dateLabel}>End</Text>
            <Text style={styles.dateValue}>
              {new Date(permit.scheduled_end).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* GPS indicator */}
      {tripActive && (
        <View style={styles.gpsRow}>
          <View style={[styles.gpsDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.gpsText}>GPS tracking active</Text>
        </View>
      )}

      {error && (
        <Text style={styles.errorText} testID="error-text">
          {error}
        </Text>
      )}

      {/* Action buttons */}
      <View style={styles.actionsCard}>
        {!tripActive && (
          <TouchableOpacity
            style={[styles.primaryBtn, (!nfcSupported || scanning) && styles.disabledBtn]}
            onPress={handleStartTrip}
            disabled={!nfcSupported || scanning}
            testID="start-trip-button"
          >
            <Text style={styles.primaryBtnText}>
              {scanning ? 'Scanning…' : 'Scan Vehicle NFC — Start Trip'}
            </Text>
          </TouchableOpacity>
        )}

        {tripActive && (
          <>
            <TouchableOpacity
              style={[styles.secondaryBtn, (!nfcSupported || scanning) && styles.disabledBtn]}
              onPress={handleSiteArrival}
              disabled={!nfcSupported || scanning}
              testID="site-arrival-button"
            >
              <Text style={styles.secondaryBtnText}>
                {scanning ? 'Scanning…' : 'Scan Site NFC — Record Arrival'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerBtn, scanning && styles.disabledBtn]}
              onPress={handleEndTrip}
              disabled={scanning}
              testID="end-trip-button"
            >
              <Text style={styles.dangerBtnText}>End Trip</Text>
            </TouchableOpacity>
          </>
        )}

        {!nfcSupported && (
          <Text style={styles.errorText}>
            NFC is not available on this device. Contact your supervisor.
          </Text>
        )}
      </View>

      {/* Assets to inspect — shown once the trip is active */}
      {tripActive && permit.permit_assets.length > 0 && (
        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Assets to Inspect</Text>
          {permit.permit_assets.map(({ asset_id, assets: assetDetail }) => (
            <TouchableOpacity
              key={asset_id}
              style={styles.assetRow}
              onPress={() =>
                router.push({
                  pathname: '/(app)/inspect/[assetId]',
                  params: { assetId: asset_id, tripId: trip?.id ?? '' },
                })
              }
              testID={`inspect-asset-${asset_id}`}
            >
              <View style={styles.assetRowInfo}>
                <Text style={styles.assetRowName}>
                  {assetDetail?.name ?? 'Unknown asset'}
                </Text>
                <Text style={styles.assetRowCode}>
                  {assetDetail?.asset_code ?? asset_id.slice(0, 8)}
                </Text>
              </View>
              <Text style={styles.assetRowAction}>Inspect</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
