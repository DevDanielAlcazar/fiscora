import { LaborRuleSet } from "./types.js";

/**
 * Returns default Mexican LFT (Ley Federal del Trabajo) rulesets for a given year.
 */
export function getDefaultRuleSet(year = 2026): LaborRuleSet {
  // Standard and Northern border zone configurations for Mexican payroll compliance
  return {
    year,
    minimumWage: 374.89,
    umaValue: 115.5,
    aguinaldoMinDays: 15,
    vacationPremiumPercent: 0.25,
  };
}
