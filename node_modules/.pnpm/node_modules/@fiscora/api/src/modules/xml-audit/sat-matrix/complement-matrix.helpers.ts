import type { SatMatrixRule, SatMatrixSummary, SatComplementKey } from "./sat-matrix.types.js";
import { COMPLEMENT_MATRIX_RULES } from "./complement-matrix.registry.js";
import { SatRuleCoverage, SatRuleSource } from "./sat-matrix.types.js";

export function getComplementMatrixRules(): SatMatrixRule[] {
  return COMPLEMENT_MATRIX_RULES.map((r) => ({ ...r }));
}

export function getComplementMatrixRulesByComplement(key: SatComplementKey): SatMatrixRule[] {
  return COMPLEMENT_MATRIX_RULES.filter((r) => r.complementKey === key).map((r) => ({ ...r }));
}

import type { SatRuleModule } from "./sat-matrix.types.js";

export function getComplementMatrixSummary(): SatMatrixSummary & { byComplement: Record<string, number> } {
  const totalRules = COMPLEMENT_MATRIX_RULES.length;
  const coveredDirect = COMPLEMENT_MATRIX_RULES.filter((r) => r.coverage === "COVERED_DIRECT").length;
  const coveredPartial = COMPLEMENT_MATRIX_RULES.filter((r) => r.coverage === "COVERED_PARTIAL").length;
  const coveredHeuristic = COMPLEMENT_MATRIX_RULES.filter((r) => r.coverage === "COVERED_HEURISTIC").length;
  const notCovered = COMPLEMENT_MATRIX_RULES.filter((r) => r.coverage === "NOT_COVERED").length;
  const needsOfficialConfirmation = COMPLEMENT_MATRIX_RULES.filter((r) => r.coverage === "NEEDS_OFFICIAL_CONFIRMATION").length;

  const byModule: Record<SatRuleModule, number> = {
    CFDI_BASE: 0,
    EMISOR_RECEPTOR: 0,
    CONCEPTOS: 0,
    IMPUESTOS_CONCEPTO: 0,
    IMPUESTOS_GLOBALES: 0,
    TOTALES: 0,
    TIMBRE_FISCAL_DIGITAL: 0,
    SELLOS_CERTIFICADOS: 0,
    CFDI_RELACIONADOS: 0,
    COMPLEMENTO_PAGO: 0,
    NOMINA: 0,
    CARTA_PORTE: 0,
    COMERCIO_EXTERIOR: 0,
    RETENCIONES: 0,
    IMPUESTOS_LOCALES: 0,
    LEYENDAS_FISCALES: 0,
    DONATARIAS: 0,
    ADDENDA: 0,
    CATALOGOS: 0,
    COHERENCIA_TRANSVERSAL: 0,
    SEGURIDAD_PAYLOAD: 0,
    ZIP_PERFORMANCE: 0,
  };
  const modules = COMPLEMENT_MATRIX_RULES.map((r) => r.module);
  for (const m of modules) {
    byModule[m] = (byModule[m] ?? 0) + 1;
  }

  const byComplement: Record<string, number> = {};
  const complements: SatComplementKey[] = [
    "PAGOS_20",
    "NOMINA_12",
    "CARTA_PORTE",
    "COMERCIO_EXTERIOR",
    "RETENCIONES_20",
  ];
  for (const c of complements) {
    byComplement[c] = COMPLEMENT_MATRIX_RULES.filter((r) => r.complementKey === c).length;
  }

  return {
    totalRules,
    coveredDirect,
    coveredPartial,
    coveredHeuristic,
    notCovered,
    needsOfficialConfirmation,
    byModule,
    byComplement,
    requiresCatalog: COMPLEMENT_MATRIX_RULES.filter((r) => r.requiresCatalog).length,
    requiresXsd: COMPLEMENT_MATRIX_RULES.filter((r) => r.requiresXsd).length,
    requiresCryptoValidation: COMPLEMENT_MATRIX_RULES.filter((r) => r.requiresCryptoValidation).length,
    requiresOnlineSatValidation: COMPLEMENT_MATRIX_RULES.filter((r) => r.requiresOnlineSatValidation).length,
  };
}

export function findComplementRulesByFiscoraCode(code: string): SatMatrixRule[] {
  return COMPLEMENT_MATRIX_RULES.filter((r) => r.fiscoraFindingCodes.includes(code)).map((r) => ({ ...r }));
}

export function validateComplementMatrixIntegrity(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = COMPLEMENT_MATRIX_RULES.map((r) => r.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push("IDs duplicados en matriz complementos");
  }

  for (const r of COMPLEMENT_MATRIX_RULES) {
    if (!r.complementKey) {
      errors.push(`Regla ${r.id} sin complementKey`);
    }
    if (!r.officialDescription || r.officialDescription.trim() === "") {
      errors.push(`Regla ${r.id} sin officialDescription`);
    }
    if (r.coverage === "NOT_COVERED" && r.fiscoraFindingCodes.length > 0) {
      errors.push(`Regla ${r.id} NOT_COVERED no debería tener finding codes`);
    }
    if ((r.coverage === "COVERED_DIRECT" || r.coverage === "COVERED_PARTIAL") && r.fiscoraFindingCodes.length === 0) {
      errors.push(`Regla ${r.id} cubierta sin finding codes`);
    }
  }

  return { valid: errors.length === 0, errors };
}