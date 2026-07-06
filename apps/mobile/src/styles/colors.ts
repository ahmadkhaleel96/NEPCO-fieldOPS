/**
 * Colour palette for the mobile app.
 * All colours are defined here — never hardcoded inline.
 * React Native StyleSheet objects import from this file.
 */
export const Colors = {
  /* Brand */
  primary50:  '#eff6ff',
  primary100: '#dbeafe',
  primary200: '#bfdbfe',
  primary300: '#93c5fd',
  primary400: '#60a5fa',
  primary500: '#3b82f6',
  primary600: '#2563eb',
  primary700: '#1d4ed8',
  primary800: '#1e40af',
  primary900: '#1e3a8a',

  /* Semantic */
  successLight: '#dcfce7',
  success:      '#16a34a',
  successDark:  '#14532d',

  warningLight: '#fef9c3',
  warning:      '#ca8a04',
  warningDark:  '#713f12',

  dangerLight:  '#fee2e2',
  danger:       '#dc2626',
  dangerDark:   '#7f1d1d',

  /* Neutral */
  neutral50:  '#f9fafb',
  neutral100: '#f3f4f6',
  neutral200: '#e5e7eb',
  neutral300: '#d1d5db',
  neutral400: '#9ca3af',
  neutral500: '#6b7280',
  neutral600: '#4b5563',
  neutral700: '#374151',
  neutral800: '#1f2937',
  neutral900: '#111827',

  /* Base */
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

/** Permit/trip status colour mapping */
export const StatusColors: Record<string, string> = {
  draft:      Colors.neutral400,
  issued:     Colors.primary500,
  active:     Colors.success,
  completed:  Colors.neutral700,
  incomplete: Colors.warning,
  suspended:  Colors.danger,
  withdrawn:  Colors.neutral500,
};
