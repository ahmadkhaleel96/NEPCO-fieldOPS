import { StyleSheet } from 'react-native';
import { Colors } from './colors';

/**
 * Typography styles for the mobile app.
 * All text styling is defined here — never inline.
 */
export const Typography = StyleSheet.create({
  h1: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
    color: Colors.neutral900,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    color: Colors.neutral900,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    color: Colors.neutral900,
  },
  h4: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    color: Colors.neutral900,
  },
  bodyLg: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28,
    color: Colors.neutral800,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: Colors.neutral800,
  },
  bodySm: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: Colors.neutral700,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: Colors.neutral500,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: Colors.neutral700,
    letterSpacing: 0.1,
  },
  mono: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
    color: Colors.neutral800,
  },
});
