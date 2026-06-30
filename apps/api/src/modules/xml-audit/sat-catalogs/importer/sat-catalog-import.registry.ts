import type {
  SatCatalogImportDefinition,
  SatCatalogCoverageStatus,
} from "./sat-catalog-import.types.js";

export const SAT_CATALOG_IMPORT_REGISTRY: SatCatalogImportDefinition[] = [
  {
    catalogKey: "c_UsoCFDI",
    displayName: "Uso de CFDI",
    format: "CSV",
    relativePath: "c_UsoCFDI.sample.csv",
    keyColumn: "c_UsoCFDI",
    labelColumn: "c_Descripcion",
    requiredColumns: [
      { name: "c_UsoCFDI", required: true },
      { name: "c_Descripcion", required: true, aliases: ["Descripcion"] },
    ],
    coverageStatus: "LOCAL_IMPORTED",
  },
  {
    catalogKey: "c_FormaPago",
    displayName: "Forma de Pago",
    format: "CSV",
    relativePath: "c_FormaPago.sample.csv",
    keyColumn: "c_FormaPago",
    labelColumn: "c_Descripcion",
    requiredColumns: [{ name: "c_FormaPago", required: true }],
    coverageStatus: "LOCAL_IMPORTED",
  },
  {
    catalogKey: "c_Moneda",
    displayName: "Moneda",
    format: "CSV",
    relativePath: "c_Moneda.sample.csv",
    keyColumn: "c_Moneda",
    labelColumn: "c_Descripcion",
    requiredColumns: [{ name: "c_Moneda", required: true }],
    coverageStatus: "LOCAL_IMPORTED",
  },
  {
    catalogKey: "c_RegimenFiscal",
    displayName: "Régimen Fiscal",
    format: "CSV",
    relativePath: "c_RegimenFiscal.sample.csv",
    keyColumn: "c_Regimen",
    labelColumn: "c_Descripcion",
    requiredColumns: [{ name: "c_Regimen", required: true }],
    coverageStatus: "LOCAL_IMPORTED",
  },
  {
    catalogKey: "c_ObjetoImp",
    displayName: "Objeto de Impuesto",
    format: "CSV",
    relativePath: "c_ObjetoImp.sample.csv",
    keyColumn: "c_ObjetoImp",
    labelColumn: "c_Descripcion",
    requiredColumns: [{ name: "c_ObjetoImp", required: true }],
    coverageStatus: "LOCAL_IMPORTED",
  },
  {
    catalogKey: "c_Impuesto",
    displayName: "Tipo de Impuesto",
    format: "CSV",
    relativePath: "c_Impuesto.sample.csv",
    keyColumn: "c_Impuesto",
    labelColumn: "c_Descripcion",
    requiredColumns: [{ name: "c_Impuesto", required: true }],
    coverageStatus: "LOCAL_IMPORTED",
  },
  {
    catalogKey: "c_TipoFactor",
    displayName: "Tipo de Factor",
    format: "CSV",
    relativePath: "c_TipoFactor.sample.csv",
    keyColumn: "c_TipoFactor",
    labelColumn: "c_Descripcion",
    requiredColumns: [{ name: "c_TipoFactor", required: true }],
    coverageStatus: "LOCAL_IMPORTED",
  },
  {
    catalogKey: "c_TasaOCuota",
    displayName: "Tasa o Cuota",
    format: "CSV",
    relativePath: "c_TasaOCuota.sample.csv",
    keyColumn: "c_TasaOCuota",
    labelColumn: "c_Descripcion",
    requiredColumns: [{ name: "c_TasaOCuota", required: true }],
    coverageStatus: "LOCAL_IMPORTED",
  },
];

export function getCatalogImportDefinition(catalogKey: string): SatCatalogImportDefinition | undefined {
  return SAT_CATALOG_IMPORT_REGISTRY.find((def) => def.catalogKey === catalogKey);
}

export function getAllCatalogImportDefinitions(): SatCatalogImportDefinition[] {
  return SAT_CATALOG_IMPORT_REGISTRY;
}

export function getCatalogImportCoverageStatus(): Array<{
  catalogKey: string;
  coverageStatus: SatCatalogCoverageStatus;
  displayName: string;
  format: string;
  path: string;
}> {
  return SAT_CATALOG_IMPORT_REGISTRY.map((def) => ({
    catalogKey: def.catalogKey,
    coverageStatus: def.coverageStatus,
    displayName: def.displayName,
    format: def.format,
    path: def.relativePath,
  }));
}