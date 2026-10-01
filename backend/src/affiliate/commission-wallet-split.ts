import { roundMoney } from '../common/utils/number.util';

export interface CommissionWalletSplit {
  withdrawAmount: number;
  reconsumptionAmount: number;
  taxAmount: number;
}

/**
 * Split one commission across the withdraw wallet, the reconsumption wallet
 * and tax. Tax takes the rounding remainder so the three parts add up to
 * `amount`.
 */
export function splitCommissionAmount(
  amount: number,
  withdrawPercent: number,
  reconsumptionPercent: number,
): CommissionWalletSplit {
  const gross = Number(amount) || 0;
  const withdrawAmount = roundMoney((gross * withdrawPercent) / 100);
  const reconsumptionAmount = roundMoney((gross * reconsumptionPercent) / 100);
  const taxAmount = Math.max(
    0,
    Math.round((gross - withdrawAmount - reconsumptionAmount) * 1e8) / 1e8,
  );
  return { withdrawAmount, reconsumptionAmount, taxAmount };
}

const DISTRIBUTED_NOTE =
  /Distributed: withdraw wallet \((\d+(?:\.\d+)?)%\), reconsumption wallet \((\d+(?:\.\d+)?)%\)/;

/**
 * Read the wallet percentages the batch payout wrote into a commission's notes
 * ("Distributed: withdraw wallet (70%), reconsumption wallet (20%), tax (10%)"),
 * or null when the notes carry none.
 */
export function parseDistributedNote(
  notes: string | null | undefined,
): { withdrawPercent: number; reconsumptionPercent: number } | null {
  const match = notes ? DISTRIBUTED_NOTE.exec(notes) : null;
  if (!match) return null;
  return {
    withdrawPercent: Number(match[1]),
    reconsumptionPercent: Number(match[2]),
  };
}
