import type { SatCatalogColumnDefinition, SatCatalogImportedEntry } from "./sat-catalog-import.types.js";

export function validateRequiredColumns(
  headers: string[],
  requiredColumns: SatCatalogColumnDefinition[],
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  const headerSet = new Set(headers.map((h) => h.toLowerCase()));

  for (const col of requiredColumns) {
    if (!headerSet.has(col.name.toLowerCase())) {
      if (col.aliases) {
        const hasAlias = col.aliases.some((a) => headerSet.has(a.toLowerCase()));
        if (!hasAlias) missing.push(col.name);
      } else {
        missing.push(col.name);
      }
    }
  }

  return { valid: missing.length === 0, missing };
}

export function validateEntries(
  entries: SatCatalogImportedEntry[],
  requiredColumns: SatCatalogColumnDefinition[],
): { valid: SatCatalogImportedEntry[]; invalid: SatCatalogImportedEntry[]; reasons: string[] } {
  const valid: SatCatalogImportedEntry[] = [];
  const invalid: SatCatalogImportedEntry[] = [];
  const reasons: string[] = [];

  for (const entry of entries) {
    let isValid = true;
    for (const col of requiredColumns) {
      const value = entry.raw[col.name];
      if (col.required && (value === undefined || value === "")) {
        isValid = false;
        reasons.push(`Clave ${entry.key}: columna ${col.name} vacía`);
      }
    }
    if (isValid) {
      valid.push(entry);
    } else {
      invalid.push(entry);
    }
  }

  return { valid, invalid, reasons };
}