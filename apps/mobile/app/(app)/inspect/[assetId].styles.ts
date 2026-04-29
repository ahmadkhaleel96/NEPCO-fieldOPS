import { StyleSheet } from 'react-native';
import { Colors } from '../../../src/styles/colors';
import { Spacing, Radius, Shadows } from '../../../src/styles/spacing';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral100,
  },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing['5xl'],
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  assetName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral900,
    marginBottom: Spacing.xs,
  },
  assetCode: {
    fontSize: 13,
    color: Colors.neutral500,
    fontFamily: 'monospace',
    marginBottom: Spacing.xs,
  },
  assetType: {
    fontSize: 14,
    color: Colors.neutral600,
    textTransform: 'capitalize',
  },
  fieldRow: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
    textTransform: 'capitalize',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.neutral300,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    color: Colors.neutral900,
    backgroundColor: Colors.white,
  },
  fieldInputFocused: {
    borderColor: Colors.primary500,
  },
  statusRow: {
    marginBottom: Spacing.md,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  statusChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neutral300,
    backgroundColor: Colors.white,
  },
  statusChipSelected: {
    borderColor: Colors.primary600,
    backgroundColor: Colors.primary50,
  },
  statusChipText: {
    fontSize: 13,
    color: Colors.neutral600,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statusChipTextSelected: {
    color: Colors.primary700,
    fontWeight: '600',
  },
  reasonOptions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  reasonChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neutral300,
    backgroundColor: Colors.white,
  },
  reasonChipSelected: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
  },
  reasonChipText: {
    fontSize: 13,
    color: Colors.neutral600,
    fontWeight: '500',
  },
  reasonChipTextSelected: {
    color: Colors.dangerDark,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: Colors.primary600,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.neutral300,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  errorText: {
    fontSize: 14,
    color: Colors.danger,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral100,
  },
});
