/**
 * Exact monetary calculation utilities for Ghanaian Cedi (GHS) and Pesewas.
 * 
 * 1 GHS = 100 Pesewas.
 * All internal math is performed strictly in integer Pesewas to prevent
 * binary floating-point rounding errors (e.g. 0.1 + 0.2 !== 0.3 or 50.29 * 100 = 5028.999999999999).
 */

export class CurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurrencyError';
  }
}

/**
 * Parses a currency input (string or number) into integer pesewas.
 * Validates against:
 * - non-numeric inputs
 * - negative amounts
 * - zero amounts
 * - fractions of a pesewa (> 2 decimal digits)
 */
export function parseGhsToPesewas(amount: string | number): number {
  if (amount === null || amount === undefined) {
    throw new CurrencyError('Amount is required.');
  }

  const str = String(amount).trim();
  if (str === '') {
    throw new CurrencyError('Amount cannot be empty.');
  }

  // Strictly match valid positive decimal currency formats: e.g. "50", "50.0", "50.00"
  // Rejects signs like '-', '+', exponential 'e', multiple decimals, non-digits.
  const regex = /^\d+(\.\d{1,2})?$/;
  if (!regex.test(str)) {
    if (/^-\d/.test(str)) {
      throw new CurrencyError(`Invalid amount "${str}": Zero or negative amounts are not allowed.`);
    }
    if (/^\d+\.\d{3,}$/.test(str)) {
      throw new CurrencyError(`Invalid amount "${str}": Sub-pesewa fractions (more than 2 decimal places) are not allowed.`);
    }
    throw new CurrencyError(`Invalid amount format: "${str}". Expected a positive number (e.g., 50.00).`);
  }

  const parts = str.split('.');
  const whole = parseInt(parts[0], 10);
  let fraction = 0;
  if (parts.length > 1) {
    const fractionStr = parts[1].padEnd(2, '0');
    fraction = parseInt(fractionStr, 10);
  }

  const totalPesewas = whole * 100 + fraction;

  if (totalPesewas <= 0) {
    throw new CurrencyError(`Amount must be greater than zero. Received: ${str}`);
  }

  return totalPesewas;
}

/**
 * Formats an integer pesewas amount into GHS string with 2 decimal places.
 * Example: 5000 -> "50.00"
 */
export function formatPesewas(pesewas: number): string {
  if (!Number.isInteger(pesewas)) {
    throw new CurrencyError(`Pesewas amount must be an integer, got: ${pesewas}`);
  }
  const isNegative = pesewas < 0;
  const abs = Math.abs(pesewas);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const fractionStr = fraction.toString().padStart(2, '0');
  const sign = isNegative ? '-' : '';
  return `${sign}${whole}.${fractionStr}`;
}

/**
 * Formats an integer pesewas amount with currency symbol.
 * Example: 5000 -> "GHS 50.00"
 */
export function formatGHS(pesewas: number): string {
  return `GHS ${formatPesewas(pesewas)}`;
}
