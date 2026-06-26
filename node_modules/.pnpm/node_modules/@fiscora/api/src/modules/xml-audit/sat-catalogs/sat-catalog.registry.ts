import type {
  SatCatalogKey,
  SatCatalogDefinition,
  SatCatalogEntry,
  CatalogCompleteness,
  CatalogSourceType,
} from "./sat-catalog.types.js";
import {
  CFDI_TIPO_COMPROBANTE,
  CFDI_MONEDAS_BASICAS,
  CFDI_EXPORTACION_BASIC,
  CFDI_METODO_PAGO_BASIC,
  CFDI_FORMA_PAGO_BASIC,
  CFDI_OBJETO_IMP_BASIC,
  CFDI_IMPUESTO_BASIC,
  CFDI_TIPO_FACTOR_BASIC,
  CFDI_TIPO_RELACION_BASIC,
  CFDI_USO_CFDI_BASIC,
  CFDI_REGIMEN_FISCAL_BASIC,
  RETENCIONES_NACIONALIDAD_BASIC,
  RETENCIONES_CVE_RETENC_BASIC,
  RETENCIONES_IMPUESTO_RET_BASIC,
  RETENCIONES_TIPO_PAGO_RET_BASIC,
  NOMINA_TIPO_NOMINA_BASIC,
  NOMINA_TIPO_REGIMEN_BASIC,
  CARTA_PORTE_TRANSP_INTERNAC_BASIC,
} from "../xml-audit.catalogs.js";

type RecordCatalog = Record<string, string>;

function toSatEntries(
  catalog: RecordCatalog,
  sourceType: CatalogSourceType,
  completeness: CatalogCompleteness,
  sourceName: string,
  notes?: string[],
): SatCatalogEntry[] {
  return Object.entries(catalog).map(([code, label]) => ({
    code,
    label,
    description: undefined,
    validFrom: undefined,
    validTo: undefined,
    appliesToPersonaFisica: undefined,
    appliesToPersonaMoral: undefined,
    metadata: undefined,
  }));
}

function createDefinition(
  key: SatCatalogKey,
  name: string,
  sourceType: CatalogSourceType,
  completeness: CatalogCompleteness,
  entries: SatCatalogEntry[],
  sourceName: string,
): SatCatalogDefinition {
  return {
    key,
    name,
    sourceType,
    sourceName,
    completeness,
    entries,
    notes: completeness !== "COMPLETE" ? [`${sourceName} - cobertura parcial/curada`] : undefined,
  };
}

const SAT_CATALOG_REGISTRY: SatCatalogDefinition[] = [
  createDefinition(
    "c_TipoDeComprobante",
    "Tipo de Comprobante",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_TIPO_COMPROBANTE, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_Moneda",
    "Moneda",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_MONEDAS_BASICAS, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_Exportacion",
    "Exportación",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_EXPORTACION_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_MetodoPago",
    "Método de Pago",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_METODO_PAGO_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_FormaPago",
    "Forma de Pago",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_FORMA_PAGO_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_ObjetoImp",
    "Objeto de Impuesto",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_OBJETO_IMP_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_Impuesto",
    "Tipo de Impuesto",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_IMPUESTO_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_TipoFactor",
    "Tipo de Factor",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_TIPO_FACTOR_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_TipoRelacion",
    "Tipo de Relación",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_TIPO_RELACION_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_UsoCFDI",
    "Uso de CFDI",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_USO_CFDI_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "c_RegimenFiscal",
    "Régimen Fiscal",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CFDI_REGIMEN_FISCAL_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo CFDI curado Fiscora"),
    "Catálogo CFDI curado Fiscora",
  ),
  createDefinition(
    "retenciones_CveRetenc",
    "Clave de Retención",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(RETENCIONES_CVE_RETENC_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo Retenciones curado Fiscora"),
    "Catálogo Retenciones curado Fiscora",
  ),
  createDefinition(
    "retenciones_ImpuestoRet",
    "Impuesto Retención",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(RETENCIONES_IMPUESTO_RET_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo Retenciones curado Fiscora"),
    "Catálogo Retenciones curado Fiscora",
  ),
  createDefinition(
    "retenciones_TipoPagoRet",
    "Tipo Pago Retención",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(RETENCIONES_TIPO_PAGO_RET_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo Retenciones curado Fiscora"),
    "Catálogo Retenciones curado Fiscora",
  ),
  createDefinition(
    "nomina_TipoNomina",
    "Tipo Nómina",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(NOMINA_TIPO_NOMINA_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo Nómina curado Fiscora"),
    "Catálogo Nómina curado Fiscora",
  ),
  createDefinition(
    "nomina_TipoRegimen",
    "Tipo Régimen Nómina",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(NOMINA_TIPO_REGIMEN_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo Nómina curado Fiscora"),
    "Catálogo Nómina curado Fiscora",
  ),
  createDefinition(
    "cartaPorte_TranspInternac",
    "Transporte Internacional Carta Porte",
    "FISCORA_CURATED",
    "PARTIAL",
    toSatEntries(CARTA_PORTE_TRANSP_INTERNAC_BASIC, "FISCORA_CURATED", "PARTIAL", "Catálogo Carta Porte curado Fiscora"),
    "Catálogo Carta Porte curado Fiscora",
  ),
];

export function getCatalogDefinition(key: SatCatalogKey): SatCatalogDefinition | undefined {
  return SAT_CATALOG_REGISTRY.find((def) => def.key === key);
}

export function getAllCatalogDefinitions(): SatCatalogDefinition[] {
  return SAT_CATALOG_REGISTRY;
}

export function getCatalogCoverageStatus(): Array<{
  key: SatCatalogKey;
  entriesCount: number;
  completeness: CatalogCompleteness;
  sourceType: CatalogSourceType;
  sourceName: string;
  notes?: string[];
}> {
  return SAT_CATALOG_REGISTRY.map((def) => ({
    key: def.key,
    entriesCount: def.entries.length,
    completeness: def.completeness,
    sourceType: def.sourceType,
    sourceName: def.sourceName,
    notes: def.notes,
  }));
}