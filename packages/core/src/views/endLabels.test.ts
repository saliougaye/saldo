import { describe, expect, it } from 'vitest';
import { endLabels } from './endLabels';

describe('endLabels', () => {
  it('shows the start, today and the end mid-range', () => {
    expect(endLabels(0.5)).toEqual({ start: true, today: true, end: true });
  });

  it('drops the end once «oggi» is close to it', () => {
    expect(endLabels(0.8)).toEqual({ start: true, today: true, end: false });
  });

  it('drops the start while «oggi» is close to it', () => {
    expect(endLabels(0.1)).toEqual({ start: false, today: true, end: true });
  });

  it('shows both ends and no «oggi» without a pace', () => {
    expect(endLabels(null)).toEqual({ start: true, today: false, end: true });
  });
});
