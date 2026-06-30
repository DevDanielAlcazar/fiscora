import type { SatCatalogImportedEntry } from "./sat-catalog-import.types.js";

export function normalizeCsvContent(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const trimmed = line.trim();
    return trimmed.split(",").map((cell) => cell.trim());
  });
}

export function parseCsvToEntries(
  rows: string[][],
  keyColumn: string,
  labelColumn?: string,
  validFromColumn?: string,
  validToColumn?: string,
  trimValues: boolean = true,
  uppercaseKey: boolean = true,
): SatCatalogImportedEntry[] {
  if (rows.length === 0) return [];

  const headers = rows[0];
  const keyIdx = headers.findIndex((h) => h.toLowerCase() === keyColumn.toLowerCase());
  const labelIdx = labelColumn
    ? headers.findIndex((h) => h.toLowerCase() === labelColumn.toLowerCase())
    : -1;
  const fromIdx = validFromColumn
    ? headers.findIndex((h) => h.toLowerCase() === validFromColumn.toLowerCase())
    : -1;
  const toIdx = validToColumn
    ? headers.findIndex((h) => h.toLowerCase() === validToColumn.toLowerCase())
    : -1;

  if (keyIdx === -1) return [];

  const entries: SatCatalogImportedEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = trimValues ? (row[idx] ?? "") : (row[idx] ?? "");
    });

    const key = uppercaseKey ? (raw[keyColumn]?.toUpperCase() ?? "") : (raw[keyColumn] ?? "");
    const label = labelIdx >= 0 && labelIdx < row.length ? raw[headers[labelIdx]] : undefined;
    const validFrom = fromIdx >= 0 && fromIdx < row.length ? raw[headers[fromIdx]] : undefined;
    const validTo = toIdx >= 0 && toIdx < row.length ? raw[headers[toIdx]] : undefined;

    entries.push({
      key,
      label,
      raw,
      validFrom,
      validTo,
      isActive: validTo ? validTo === "" || validTo === "NULL" : true,
    });
  }

  return entries;
}

export function parseJsonToEntries(
  content: string,
  keyField: string,
  labelField?: string,
  validFromField?: string,
  validToField?: string,
  trimValues: boolean = true,
  uppercaseKey: boolean = true,
): SatCatalogImportedEntry[] {
  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) return [];

    return data.map((item: Record<string, unknown>) => {
      const raw: Record<string, string> = {};
      for (const [k, v] of Object.entries(item)) {
        raw[k] = String(v ?? "");
      }
      const key = uppercaseKey
        ? String(item[keyField] ?? "").toUpperCase()
        : String(item[keyField] ?? "");
      const label = labelField ? String(item[labelField] ?? "") : undefined;
      const validFrom = validFromField ? String(item[validFromField] ?? "") : undefined;
      const validTo = validToField ? String(item[validToField] ?? "") : undefined;

      return { key, label, raw, validFrom, validTo, isActive: !validTo || validTo === "" };
    });
  } catch {
    return [];
  }
}