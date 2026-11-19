import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, fromMinor, parseDecimal, parseMoney, roundHalfUp, toMinor } from '../money';

describe('roundHalfUp / toMinor', () => {
  it('elimină erorile de virgulă mobilă', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(2.675)).toBe(268); // 2.675 * 100 = 267.49999… în binar
    expect(toMinor(1.005)).toBe(101);
  });
  it('rotunjește jumătatea în afară de zero pentru negative', () => {
    expect(toMinor(-1.005)).toBe(-101);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.5)).toBe(3);
  });
  it('nu întoarce -0', () => {
    expect(Object.is(roundHalfUp(-0.001, 2), 0)).toBe(true);
  });
  it('rotunjește la zecimale cerute', () => {
    expect(roundHalfUp(41.5111, 2)).toBe(41.51);
    expect(roundHalfUp(0.23125, 4)).toBe(0.2313);
  });
  it('respinge valori nefinite', () => {
    expect(() => roundHalfUp(Number.NaN)).toThrow();
    expect(() => roundHalfUp(Number.POSITIVE_INFINITY)).toThrow();
  });
  it('fromMinor convertește în unități', () => {
    expect(fromMinor(1868)).toBe(18.68);
  });
});

describe('parseDecimal', () => {
  it.each([
    ['35,5', 35.5],
    ['35.5', 35.5],
    ['35', 35],
    [' 12 ', 12],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234.567', 1234567],
    ['1 234,5', 1234.5],
    [',5', 0.5],
    ['7,', 7],
    ['-3,2', -3.2],
  ])('„%s” → %d', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '1,2,3,4', '12a', '1.23.4', '--1', '1,2.3,4'])('„%s” → null', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });
});

describe('parseMoney (sume în lei)', () => {
  it.each([
    ['1.500', 1500], // punct de mii, cum scriu românii
    ['12.500', 12500],
    ['1.500,50', 1500.5],
    ['1,234.56', 1234.56],
    ['35', 35],
    ['35,5', 35.5],
    ['35.50', 35.5],
    ['1.5', 1.5],
    ['0,99', 0.99],
  ])('„%s” → %d', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(['1,505', '0.005', '1234.567', 'abc', ''])('„%s” → null (nu e o sumă cu cel mult 2 zecimale)', (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe('formatare', () => {
  it('formatMoney folosește formatul românesc', () => {
    const s = formatMoney(123456, 'RON');
    expect(s).toContain('1.234,56');
    expect(s).toContain('RON');
  });
  it('formatMoney acceptă altă monedă', () => {
    expect(formatMoney(1050, 'EUR')).toContain('10,50');
  });
  it('formatNumber afișează „—” pentru lipsă', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(41.5111)).toBe('41,51');
    expect(formatNumber(1234.5, 1)).toBe('1.234,5');
  });
});
