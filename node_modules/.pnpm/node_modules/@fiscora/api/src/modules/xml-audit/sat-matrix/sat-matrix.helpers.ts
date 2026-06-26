import type {
  SatMatrixRule,
  SatRuleModule,
  SatRuleCoverage,
  SatMatrixSummary,
} from "./sat-matrix.types.js";
import { CFDI40_MATRIX_RULES } from "./cfdi40-matrix.registry.js";

export function getCfdi40MatrixRules(): SatMatrixRule[] {
  return CFDI40_MATRIX_RULES.map((r) => ({ ...r }));
}

export function findRulesByFiscoraCode(code: string): SatMatrixRule[] {
  return CFDI40_MATRIX_RULES.filter((r) => r.fiscoraFindingCodes.includes(code));
}

export function findRulesByModule(module: SatRuleModule): SatMatrixRule[] {
  return CFDI40_MATRIX_RULES.filter((r) => r.module === module);
}

export function getSatMatrixSummary(rules: SatMatrixRule[] = CFDI40_MATRIX_RULES): SatMatrixSummary {
  const summary: SatMatrixSummary = {
    totalRules: rules.length,
    coveredDirect: 0,
    coveredPartial: 0,
    coveredHeuristic: 0,
    notCovered: 0,
    needsOfficialConfirmation: 0,
    byModule: {} as Record<SatRuleModule, number>,
    requiresCatalog: 0,
    requiresXsd: 0,
    requiresCryptoValidation: 0,
    requiresOnlineSatValidation: 0,
  };

  for (const rule of rules) {
    const mod = rule.module;
    summary.byModule[mod] = (summary.byModule[mod] ?? 0) + 1;

    if (rule.coverage === "COVERED_DIRECT") summary.coveredDirect++;
    else if (rule.coverage === "COVERED_PARTIAL") summary.coveredPartial++;
    else if (rule.coverage === "COVERED_HEURISTIC") summary.coveredHeuristic++;
    else if (rule.coverage === "NOT_COVERED") summary.notCovered++;
    else if (rule.coverage === "NEEDS_OFFICIAL_CONFIRMATION") summary.needsOfficialConfirmation++;

    if (rule.requiresCatalog) summary.requiresCatalog++;
    if (rule.requiresXsd) summary.requiresXsd++;
    if (rule.requiresCryptoValidation) summary.requiresCryptoValidation++;
    if (rule.requiresOnlineSatValidation) summary.requiresOnlineSatValidation++;
  }

  return summary;
}

export function getCoverageForFindingCode(code: string): {
  mapped: boolean;
  coverage: SatRuleCoverage[];
  modules: SatRuleModule[];
  officialDescriptions: string[];
  needsOfficialConfirmation: boolean;
} {
  const rules = findRulesByFiscoraCode(code);
  if (rules.length === 0) {
    return {
      mapped: false,
      coverage: [],
      modules: [],
      officialDescriptions: [],
      needsOfficialConfirmation: false,
    };
  }
  const modules = Array.from(new Set(rules.map((r) => r.module)));
  const coverage = Array.from(new Set(rules.map((r) => r.coverage)));
  const officialDescriptions = rules.map((r) => r.officialDescription);
  const needsOfficialConfirmation = rules.some((r) => r.coverage === "NEEDS_OFFICIAL_CONFIRMATION");

  return {
    mapped: true,
    coverage,
    modules,
    officialDescriptions,
    needsOfficialConfirmation,
  };
}

export interface MatrixIntegrityResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMatrixIntegrity(rules: SatMatrixRule[] = CFDI40_MATRIX_RULES): MatrixIntegrityResult {
  const result: MatrixIntegrityResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const ids = rules.map((r) => r.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    result.valid = false;
    result.errors.push("IDs duplicados en la matriz");
  }

  for (const rule of rules) {
    if (!rule.officialDescription || rule.officialDescription.trim().length === 0) {
      result.valid = false;
      result.errors.push(`Regla ${rule.id} sin officialDescription`);
    }

    const isNotCovered = rule.coverage === "NOT_COVERED" || rule.coverage === "NOT_APPLICABLE";
    if (isNotCovered && rule.fiscoraFindingCodes.length > 0) {
      result.warnings.push(`Regla ${rule.id} NOT_COVERED tiene códigos Fiscora`);
    }
  }

  return result;
}