import { describe, expect, it } from 'vitest';
import { hiddenBaseline, polylinePoints, sparklinePoints, trendGeometry } from './polyline';

describe('polylinePoints', () => {
  it('spreads the series across the width, min at the bottom and min + span at the top', () => {
    expect(polylinePoints([0, 50, 100], 200, 100, 0, 100)).toBe('0.0,100.0 100.0,50.0 200.0,0.0');
  });

  it('puts a single value in the middle', () => {
    expect(polylinePoints([100], 200, 100, 0, 100)).toBe('100.0,0.0');
  });

  it('draws nothing for an empty series', () => {
    expect(polylinePoints([], 200, 100, 0, 100)).toBe('');
  });
});

describe('hiddenBaseline', () => {
  it('is a flat line at half height', () => {
    expect(hiddenBaseline(300, 96)).toBe('0,48.0 300.0,48.0');
  });
});

describe('trendGeometry', () => {
  it('scales both series on the larger of the two', () => {
    const trend = trendGeometry([0, 30], [0, 60], 100, 60);
    expect(trend.current).toBe('0.0,60.0 100.0,30.0');
    expect(trend.usual).toBe('0.0,60.0 100.0,0.0');
  });

  it('marks the last point of the current series at the right edge', () => {
    expect(trendGeometry([0, 30], [0, 60], 100, 60).last).toEqual({ x: 100, y: 30 });
  });

  it('centres the mark of a one-day cycle', () => {
    expect(trendGeometry([10], [], 100, 60).last).toEqual({ x: 50, y: 0 });
  });

  it('has no mark without a current series, and keeps a flat zero on the floor', () => {
    const empty = trendGeometry([], [0, 0], 100, 60);
    expect(empty.last).toBeNull();
    expect(empty.usual).toBe('0.0,60.0 100.0,60.0');
  });
});

describe('sparklinePoints', () => {
  it('keeps zero inside the scale so a positive series starts from the floor', () => {
    expect(sparklinePoints([50, 100], 100, 48)).toBe('0.0,24.0 100.0,0.0');
  });

  it('handles a balance that went negative', () => {
    expect(sparklinePoints([-50, 50], 100, 48)).toBe('0.0,48.0 100.0,0.0');
  });

  it('draws a flat all-zero series on the floor', () => {
    expect(sparklinePoints([0, 0], 100, 48)).toBe('0.0,48.0 100.0,48.0');
  });
});
