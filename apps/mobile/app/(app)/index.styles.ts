import { StyleSheet } from 'react-native';
import { Colors } from '../../src/styles/colors';
import { Spacing, Radius, Shadows } from '../../src/styles/spacing';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  listContent: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: Colors.neutral500,
    fontSize: 15,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  permitNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral900,
    fontFamily: 'monospace',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  permitType: {
    fontSize: 14,
    color: Colors.neutral600,
    textTransform: 'capitalize',
    marginBottom: Spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  dateLabel: {
    fontSize: 12,
    color: Colors.neutral400,
  },
  dateValue: {
    fontSize: 12,
    color: Colors.neutral700,
  },
  actionBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary600,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
