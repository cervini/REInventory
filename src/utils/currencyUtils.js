/**
 * Constants for currency conversion
 * 1 GP = 10 SP = 100 CP
 */
const RATES = {
  gp: 100,
  sp: 10,
  cp: 1,
};

/**
 * Parses a cost string into a copper value.
 * Supports formats like "10gp", "5 sp", "100cp".
 * Returns 0 if invalid or free.
 * @param {string} costStr 
 * @returns {number} Value in Copper Pieces (CP)
 */
export const parseCostToCp = (costStr) => {
  if (!costStr || typeof costStr !== 'string') return 0;
  
  const normalized = costStr.toLowerCase().trim();
  const match = normalized.match(/(\d+)\s*(gp|sp|cp)/);

  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  return value * (RATES[unit] || 0);
};

/**
 * Converts a wallet object { gp, sp, cp } to total Copper value.
 */
export const walletToCp = (wallet) => {
  if (!wallet) return 0;
  return (
    (wallet.gp || 0) * RATES.gp +
    (wallet.sp || 0) * RATES.sp +
    (wallet.cp || 0) * RATES.cp
  );
};

/**
 * Deducts a CP cost from a wallet, prioritizing lower denominations (CP -> SP -> GP).
 * This mimics "making change" automatically.
 * @param {object} wallet - Current wallet { gp, sp, cp }
 * @param {number} costInCp - Amount to subtract in CP
 * @returns {object|null} New wallet object, or NULL if insufficient funds.
 */
export const deductCurrency = (wallet, costInCp) => {
  let currentTotal = walletToCp(wallet);
  
  if (currentTotal < costInCp) return null; // Insufficient funds

  let remainingTotal = currentTotal - costInCp;

  // Convert back to largest denominations possible
  const newGp = Math.floor(remainingTotal / RATES.gp);
  remainingTotal %= RATES.gp;

  const newSp = Math.floor(remainingTotal / RATES.sp);
  remainingTotal %= RATES.sp;

  const newCp = remainingTotal;

  return { gp: newGp, sp: newSp, cp: newCp };
};