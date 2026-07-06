import { StyleSheet } from 'react-native';
import { Colors } from '../../../src/styles/colors';
import { Spacing, Radius, Shadows } from '../../../src/styles/spacing';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
    padding: Spacing.base,
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    ...Shadows.sm,
  },
  permitNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral900,
    fontFamily: 'monospace',
    marginBottom: Spacing.xs,
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
    marginTop: Spacing.xs,
  },
  dateLabel: {
    fontSize: 12,
    color: Colors.neutral400,
  },
  dateValue: {
    fontSize: 12,
    color: Colors.neutral700,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  gpsDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },
  gpsText: {
    fontSize: 13,
    color: Colors.neutral600,
  },
  actionsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.primary600,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: Colors.neutral100,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral200,
  },
  secondaryBtnText: {
    color: Colors.neutral700,
    fontSize: 16,
    fontWeight: '500',
  },
  dangerBtn: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  statusBanner: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
    alignItems: 'center',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutral500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  assetRowInfo: {
    flex: 1,
    gap: 2,
  },
  assetRowName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.neutral800,
  },
  assetRowCode: {
    fontSize: 12,
    color: Colors.neutral400,
    fontFamily: 'monospace',
  },
  assetRowAction: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary600,
    paddingLeft: Spacing.base,
  },
});
