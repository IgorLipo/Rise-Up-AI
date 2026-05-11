// Integer pence arithmetic for GBP financial calculations.
// All internal computation in pence (integers). Convert only at display time.

const PENCE_PER_POUND = 100;
const BALANCE_VALIDATION_TOLERANCE_PENCE = 2; // 2p tolerance

export function toPence(gbp: number): number {
  return Math.round(gbp * PENCE_PER_POUND);
}

export function fromPence(pence: number): number {
  return pence / PENCE_PER_POUND;
}

export function addPence(a: number, b: number): number {
  return toPence(a) + toPence(b);
}

export function subtractPence(a: number, b: number): number {
  return toPence(a) - toPence(b);
}

export interface BalanceValidation {
  valid: boolean;
  differencePence: number;
  message: string;
}

export function validateStatementBalance(
  opening: number,
  credits: number,
  debits: number,
  closing: number
): BalanceValidation {
  const openingP = toPence(opening);
  const creditsP = toPence(credits);
  const debitsP = toPence(debits);
  const closingP = toPence(closing);
  const expectedP = openingP + creditsP - debitsP;
  const diffP = Math.abs(closingP - expectedP);
  return {
    valid: diffP <= BALANCE_VALIDATION_TOLERANCE_PENCE,
    differencePence: diffP,
    message: diffP <= BALANCE_VALIDATION_TOLERANCE_PENCE
      ? "Balance validates"
      : `Balance mismatch: expected ${fromPence(expectedP)} but statement says ${fromPence(closingP)} (diff: ${diffP}p)`,
  };
}
