import type { SatCatalogDefinition, SatCatalogEntry } from "./sat-catalog.types.js";

export const SAT_CATALOG_SEED_NOTES = `
# SAT Catalog Seed Notes

Este archivo documenta la estructura esperada para catálogos oficiales SAT
cuando se carguen como JSON/XML desde fuentes controladas.

NO contiene catálogos oficiales completos - solo estructura de referencia.

Formato esperado:
{
  "key": "c_FormaPago",
  "name": "Forma de Pago",
  "sourceType": "SAT_OFFICIAL",
  "sourceName": "c_FormaPago_2024_01",
  "sourceVersion": "2024-01-01",
  "lastReviewedAt": "2024-01-15",
  "completeness": "COMPLETE",
  "entries": [
    { "code": "01", "label": "Efectivo", "validFrom": "2005-01-01" },
    { "code": "02", "label": "Cheque nominativo", "validFrom": "2005-01-01" }
  ]
}
`;

export const SAT_CATALOG_LOAD_ORDER: string[] = [
  "c_FormaPago",
  "c_MetodoPago",
  "c_UsoCFDI",
  "c_RegimenFiscal",
  "c_TipoDeComprobante",
  "c_Moneda",
  "c_ObjetoImp",
  "c_Impuesto",
  "c_TipoFactor",
  "c_TasaOCuota",
  "c_TipoRelacion",
  "c_Exportacion",
  "c_Pais",
  "c_CodigoPostal",
  "c_ClaveProdServ",
  "c_ClaveUnidad",
];

export function isCatalogEntryValidOnDate(entry: SatCatalogEntry, dateStr: string): boolean {
  if (!entry.validFrom && !entry.validTo) return true;
  const checkDate = new Date(dateStr);
  if (isNaN(checkDate.getTime())) return true;
  if (entry.validFrom) {
    const from = new Date(entry.validFrom);
    if (!isNaN(from.getTime()) && checkDate < from) return false;
  }
  if (entry.validTo) {
    const to = new Date(entry.validTo);
    if (!isNaN(to.getTime()) && checkDate > to) return false;
  }
  return true;
}