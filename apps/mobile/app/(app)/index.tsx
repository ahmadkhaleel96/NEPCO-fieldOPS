import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import type { ApiClientWorkPermit } from '@fieldops/api-client';
import { apiClient } from '../../src/lib/api';
import { Colors, StatusColors } from '../../src/styles/colors';
import styles from './index.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function PermitCard({
  permit,
  onPress,
}: {
  permit: ApiClientWorkPermit;
  onPress: (permit: ApiClientWorkPermit) => void;
}) {
  const statusColor = StatusColors[permit.status] ?? Colors.neutral400;
  const isActionable = permit.status === 'issued' || permit.status === 'active';

  return (
    <View style={styles.card} testID={`permit-card-${permit.id}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.permitNumber}>{permit.permit_number}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{permit.status}</Text>
        </View>
      </View>

      <Text style={styles.permitType}>{permit.permit_type}</Text>

      <View style={styles.dateRow}>
        <View>
          <Text style={styles.dateLabel}>Start</Text>
          <Text style={styles.dateValue}>{formatDate(permit.scheduled_start)}</Text>
        </View>
        <View>
          <Text style={styles.dateLabel}>End</Text>
          <Text style={styles.dateValue}>{formatDate(permit.scheduled_end)}</Text>
        </View>
      </View>

      {isActionable && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onPress(permit)}
          testID={`permit-action-${permit.id}`}
        >
          <Text style={styles.actionBtnText}>
            {permit.status === 'active' ? 'Continue Trip' : 'Start Trip'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function PermitsScreen() {
  const router = useRouter();
  const [permits, setPermits] = useState<ApiClientWorkPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPermits = useCallback(async () => {
    try {
      const res = await apiClient.workPermits.list({ per_page: 50 });
      // Show only permits relevant to field team (issued or active)
      setPermits(res.data.filter((p) => p.status === 'issued' || p.status === 'active'));
      setError(null);
    } catch {
      setError('Failed to load permits. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPermits();
  }, [loadPermits]);

  function handleRefresh() {
    setRefreshing(true);
    void loadPermits();
  }

  function handlePermitPress(permit: ApiClientWorkPermit) {
    router.push(`/(app)/trip/${permit.id}`);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary600} testID="loading-indicator" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText} testID="error-text">
          {error}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.listContent, permits.length === 0 && { flex: 1 }]}
      data={permits}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PermitCard permit={item} onPress={handlePermitPress} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText} testID="empty-text">
            No active permits assigned to you.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    />
  );
}
