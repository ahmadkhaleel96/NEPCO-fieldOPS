import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ApiClientAsset, IncompleteReason, InspectionStatus } from '@fieldops/api-client';
import { apiClient } from '../../../src/lib/api';
import { enqueue } from '../../../src/services/offline-queue.service';
import { Colors } from '../../../src/styles/colors';
import styles from './[assetId].styles';

const INSPECTION_STATUSES: InspectionStatus[] = ['open', 'pending', 'incomplete', 'deferred'];

const INCOMPLETE_REASONS: { value: IncompleteReason; label: string }[] = [
  { value: 'device_failure', label: 'Device failure' },
  { value: 'safety_hazard', label: 'Safety hazard' },
  { value: 'access_restricted', label: 'Access restricted' },
  { value: 'equipment_missing', label: 'Equipment missing' },
];

const DEFAULT_FIELDS = { condition: '', notes: '' };

export default function InspectAssetScreen() {
  const { assetId, tripId } = useLocalSearchParams<{ assetId: string; tripId: string }>();
  const router = useRouter();

  const [asset, setAsset] = useState<ApiClientAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<InspectionStatus>('open');
  const [incompleteReason, setIncompleteReason] = useState<IncompleteReason | null>(null);

  const loadAsset = useCallback(async () => {
    if (!assetId) return;
    try {
      const res = await apiClient.assets.get(assetId);
      setAsset(res.data);
      const fields =
        Object.keys(res.data.metadata).length > 0
          ? Object.fromEntries(
              Object.entries(res.data.metadata).map(([k, v]) => [k, String(v ?? '')])
            )
          : { ...DEFAULT_FIELDS };
      setFormData(fields);
    } catch {
      setError('Failed to load asset details.');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void loadAsset();
  }, [loadAsset]);

  async function handleSubmit() {
    if (!asset || !tripId) return;

    if (status === 'incomplete' && !incompleteReason) {
      setError('Please select a reason for the incomplete inspection.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const idempotencyKey = crypto.randomUUID();
    const submitPayload = {
      trip_id: tripId,
      asset_id: asset.id,
      status,
      form_data: formData,
      incomplete_reason: status === 'incomplete' ? (incompleteReason ?? undefined) : undefined,
      idempotency_key: idempotencyKey,
    };

    try {
      await apiClient.assetInspections.submit(submitPayload);

      if (status === 'incomplete' && incompleteReason === 'safety_hazard') {
        Alert.alert(
          'Safety Hazard Reported',
          'The permit has been suspended and your supervisor has been notified.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Inspection Submitted', 'Your inspection has been recorded successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch {
      try {
        await enqueue('inspection_submit', submitPayload as Record<string, unknown>);
        Alert.alert(
          'Offline',
          'Inspection queued and will sync when connected.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } catch {
        setError('Failed to submit inspection. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary600} testID="loading-indicator" />
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Asset not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Asset info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Asset</Text>
        <Text style={styles.assetName}>{asset.name}</Text>
        <Text style={styles.assetCode}>{asset.asset_code}</Text>
        <Text style={styles.assetType}>{asset.asset_type.replace(/_/g, ' ')}</Text>
      </View>

      {/* Field form — each metadata key is an editable field */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Inspection Fields</Text>
        {Object.entries(formData).map(([key, value]) => (
          <View key={key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{key.replace(/_/g, ' ')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={value}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, [key]: text }))}
              placeholder={`Enter ${key}`}
              placeholderTextColor={Colors.neutral400}
              testID={`field-input-${key}`}
            />
          </View>
        ))}
      </View>

      {/* Inspection status */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Inspection Status</Text>
        <View style={styles.statusOptions}>
          {INSPECTION_STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.statusChip, status === s && styles.statusChipSelected]}
              onPress={() => {
                setStatus(s);
                if (s !== 'incomplete') setIncompleteReason(null);
              }}
              testID={`status-chip-${s}`}
            >
              <Text
                style={[styles.statusChipText, status === s && styles.statusChipTextSelected]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Incomplete reason — only shown when status is incomplete */}
      {status === 'incomplete' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reason for Incomplete</Text>
          <View style={styles.reasonOptions}>
            {INCOMPLETE_REASONS.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.reasonChip,
                  incompleteReason === value && styles.reasonChipSelected,
                ]}
                onPress={() => setIncompleteReason(value)}
                testID={`reason-chip-${value}`}
              >
                <Text
                  style={[
                    styles.reasonChipText,
                    incompleteReason === value && styles.reasonChipTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        testID="submit-inspection-button"
      >
        <Text style={styles.submitBtnText}>
          {submitting ? 'Submitting…' : 'Submit Inspection'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
