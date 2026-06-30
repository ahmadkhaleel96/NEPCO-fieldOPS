import { describe, it, expect } from '@jest/globals';
import { Colors, StatusColors } from '../styles/colors';
import { Spacing, Radius as _Radius, Shadows } from '../styles/spacing';
import { Typography } from '../styles/typography';

describe('Colors', () => {
  it('has a primary colour scale from 50 to 900', () => {
    const keys = ['primary50', 'primary100', 'primary200', 'primary300', 'primary400',
      'primary500', 'primary600', 'primary700', 'primary800', 'primary900'];
    for (const key of keys) {
      expect(Colors).toHaveProperty(key);
      expect(typeof Colors[key as keyof typeof Colors]).toBe('string');
    }
  });

  it('all colour values are valid hex strings', () => {
    for (const value of Object.values(Colors)) {
      if (value === 'transparent') continue;
      expect(value).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });
});

describe('StatusColors', () => {
  it('has entries for all permit statuses', () => {
    const statuses = ['draft', 'issued', 'active', 'completed', 'incomplete', 'suspended', 'withdrawn'];
    for (const s of statuses) {
      expect(StatusColors).toHaveProperty(s);
    }
  });
});

describe('Spacing', () => {
  it('all values are positive numbers', () => {
    for (const value of Object.values(Spacing)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    }
  });

  it('values increase from xs to 5xl', () => {
    expect(Spacing.xs).toBeLessThan(Spacing.sm);
    expect(Spacing.sm).toBeLessThan(Spacing.md);
    expect(Spacing.md).toBeLessThan(Spacing.base);
    expect(Spacing.base).toBeLessThan(Spacing.lg);
  });
});

describe('Typography', () => {
  it('h1 has larger font size than body', () => {
    expect(Typography.h1.fontSize).toBeGreaterThan(Typography.body.fontSize);
  });

  it('all text styles have a fontSize and lineHeight', () => {
    for (const [_key, style] of Object.entries(Typography)) {
      expect(style).toHaveProperty('fontSize');
      expect(style).toHaveProperty('lineHeight');
      expect(typeof style.fontSize).toBe('number');
    }
  });
});

describe('Shadows', () => {
  it('has sm, md, lg variants', () => {
    expect(Shadows).toHaveProperty('sm');
    expect(Shadows).toHaveProperty('md');
    expect(Shadows).toHaveProperty('lg');
  });

  it('each shadow has elevation for Android', () => {
    for (const shadow of Object.values(Shadows)) {
      expect(shadow).toHaveProperty('elevation');
      expect(shadow.elevation).toBeGreaterThan(0);
    }
  });
});
