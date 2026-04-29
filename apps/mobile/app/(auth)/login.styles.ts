import { StyleSheet } from 'react-native';
import { Colors } from '../../src/styles/colors';
import { Spacing, Radius, Shadows } from '../../src/styles/spacing';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary700,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius['2xl'],
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...Shadows.lg,
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary700,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.neutral500,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral700,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral200,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.neutral900,
    backgroundColor: Colors.white,
    marginBottom: Spacing.base,
  },
  inputFocused: {
    borderColor: Colors.primary500,
  },
  button: {
    backgroundColor: Colors.primary600,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
