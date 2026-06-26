import type { SatMatrixRule, SatComplementKey } from "./sat-matrix.types.js";
import { PAGOS20_MATRIX_RULES } from "./complementos/pagos-matrix.rules.js";
import { NOMINA12_MATRIX_RULES } from "./complementos/nomina-matrix.rules.js";
import { CARTA_PORTE_MATRIX_RULES } from "./complementos/cartaporte-matrix.rules.js";
import { COMERCIO_EXTERIOR_MATRIX_RULES } from "./complementos/comercioexterior-matrix.rules.js";
import { RETENCIONES20_MATRIX_RULES } from "./complementos/retenciones-matrix.rules.js";

export const COMPLEMENT_MATRIX_RULES: SatMatrixRule[] = [
  ...PAGOS20_MATRIX_RULES,
  ...NOMINA12_MATRIX_RULES,
  ...CARTA_PORTE_MATRIX_RULES,
  ...COMERCIO_EXTERIOR_MATRIX_RULES,
  ...RETENCIONES20_MATRIX_RULES,
];

export function getComplementMatrixRules(): SatMatrixRule[] {
  return COMPLEMENT_MATRIX_RULES.map((r) => ({ ...r }));
}

export function getComplementMatrixRulesByComplement(key: SatComplementKey): SatMatrixRule[] {
  return COMPLEMENT_MATRIX_RULES.filter((r) => r.complementKey === key).map((r) => ({ ...r }));
}