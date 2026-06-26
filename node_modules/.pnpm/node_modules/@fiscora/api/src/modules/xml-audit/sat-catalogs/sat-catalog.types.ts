export type CatalogCompleteness = "COMPLETE" | "PARTIAL" | "CURATED" | "UNKNOWN";

export type CatalogSourceType = "SAT_OFFICIAL" | "FISCORA_CURATED" | "INTERNAL_HEURISTIC";

export type SatCatalogKey =
  | "c_FormaPago"
  | "c_MetodoPago"
  | "c_UsoCFDI"
  | "c_RegimenFiscal"
  | "c_TipoDeComprobante"
  | "c_Moneda"
  | "c_ObjetoImp"
  | "c_Impuesto"
  | "c_TipoFactor"
  | "c_TasaOCuota"
  | "c_TipoRelacion"
  | "c_Exportacion"
  | "c_Pais"
  | "c_CodigoPostal"
  | "c_ClaveProdServ"
  | "c_ClaveUnidad"
  | "nomina_TipoNomina"
  | "nomina_TipoRegimen"
  | "nomina_TipoPercepcion"
  | "nomina_TipoDeduccion"
  | "nomina_TipoOtroPago"
  | "cartaPorte_TranspInternac"
  | "cartaPorte_ConfigAutotransporte"
  | "cartaPorte_MaterialPeligroso"
  | "comercioExterior_Incoterm"
  | "comercioExterior_FraccionArancelaria"
  | "retenciones_CveRetenc"
  | "retenciones_ImpuestoRet"
  | "retenciones_TipoPagoRet";

export interface SatCatalogEntry {
  code: string;
  label: string;
  description?: string;
  validFrom?: string;
  validTo?: string;
  appliesToPersonaFisica?: boolean;
  appliesToPersonaMoral?: boolean;
  allowedRegimenFiscal?: string[];
  disallowedRegimenFiscal?: string[];
  metadata?: Record<string, string | number | boolean | string[]>;
}

export interface SatCatalogDefinition {
  key: SatCatalogKey;
  name: string;
  sourceType: CatalogSourceType;
  sourceName: string;
  sourceVersion?: string;
  lastReviewedAt?: string;
  completeness: CatalogCompleteness;
  entries: SatCatalogEntry[];
  notes?: string[];
}

export interface CatalogLookupOptions {
  cfdiDate?: string;
  normalize?: boolean;
}

export interface CatalogLookupResult {
  known: boolean;
  activeOnDate: boolean | null;
  entry?: SatCatalogEntry;
  label?: string;
  reason?: string;
  completeness: CatalogCompleteness;
  sourceType: CatalogSourceType;
  sourceName: string;
}