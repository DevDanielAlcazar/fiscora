export type SatRuleSource =
  | "CFDI40_ANEXO20"
  | "CFDI40_MATRIZ_ERRORES"
  | "CFDI40_GUIA_LLENADO"
  | "FISCORA_FORENSIC"
  | "FISCORA_OPERATIONAL"
  | "UNKNOWN";

export type SatRuleCoverage =
  | "COVERED_DIRECT"
  | "COVERED_PARTIAL"
  | "COVERED_HEURISTIC"
  | "NOT_COVERED"
  | "NOT_APPLICABLE"
  | "NEEDS_OFFICIAL_CONFIRMATION";

export type SatRuleSeverityAlignment =
  | "SAME"
  | "FISCORA_STRONGER"
  | "FISCORA_WEAKER"
  | "NOT_MAPPED"
  | "UNKNOWN";

export type SatComplementKey =
  | "PAGOS_20"
  | "NOMINA_12"
  | "CARTA_PORTE"
  | "COMERCIO_EXTERIOR"
  | "RETENCIONES_20"
  | "IMPUESTOS_LOCALES"
  | "LEYENDAS_FISCALES"
  | "DONATARIAS"
  | "ADDENDA";

export type SatRuleModule =
  | "CFDI_BASE"
  | "EMISOR_RECEPTOR"
  | "CONCEPTOS"
  | "IMPUESTOS_CONCEPTO"
  | "IMPUESTOS_GLOBALES"
  | "TOTALES"
  | "TIMBRE_FISCAL_DIGITAL"
  | "SELLOS_CERTIFICADOS"
  | "CFDI_RELACIONADOS"
  | "COMPLEMENTO_PAGO"
  | "NOMINA"
  | "CARTA_PORTE"
  | "COMERCIO_EXTERIOR"
  | "RETENCIONES"
  | "IMPUESTOS_LOCALES"
  | "LEYENDAS_FISCALES"
  | "DONATARIAS"
  | "ADDENDA"
  | "CATALOGOS"
  | "COHERENCIA_TRANSVERSAL"
  | "SEGURIDAD_PAYLOAD"
  | "ZIP_PERFORMANCE";

export interface SatMatrixRule {
  id: string;
  source: SatRuleSource;
  officialCode?: string;
  officialField?: string;
  officialDescription: string;
  module: SatRuleModule;
  complementKey?: SatComplementKey;
  coverage: SatRuleCoverage;
  fiscoraFindingCodes: string[];
  severityAlignment: SatRuleSeverityAlignment;
  notes?: string[];
  testCases?: string[];
  requiresCatalog?: boolean;
  requiredCatalogs?: string[];
  officialReference?: string;
  requiresXsd?: boolean;
  requiresCryptoValidation?: boolean;
  requiresOnlineSatValidation?: boolean;
}

export interface SatMatrixRule {
  id: string;
  source: SatRuleSource;
  officialCode?: string;
  officialField?: string;
  officialDescription: string;
  module: SatRuleModule;
  coverage: SatRuleCoverage;
  fiscoraFindingCodes: string[];
  severityAlignment: SatRuleSeverityAlignment;
  notes?: string[];
  testCases?: string[];
  requiresCatalog?: boolean;
  requiresXsd?: boolean;
  requiresCryptoValidation?: boolean;
  requiresOnlineSatValidation?: boolean;
}

export interface SatMatrixSummary {
  totalRules: number;
  coveredDirect: number;
  coveredPartial: number;
  coveredHeuristic: number;
  notCovered: number;
  needsOfficialConfirmation: number;
  byModule: Record<SatRuleModule, number>;
  requiresCatalog: number;
  requiresXsd: number;
  requiresCryptoValidation: number;
  requiresOnlineSatValidation: number;
}