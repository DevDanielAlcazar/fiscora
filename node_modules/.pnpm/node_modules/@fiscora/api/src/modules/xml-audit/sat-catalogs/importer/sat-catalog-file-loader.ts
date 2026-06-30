import type { SatCatalogSourceFormat } from "./sat-catalog-import.types.js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadSatCatalogFile(
  relativePath: string,
  format: SatCatalogSourceFormat,
): { content: string; exists: boolean; error?: string } {
  const filePath = join(__dirname, "fixtures", relativePath);

  if (!existsSync(filePath)) {
    return { content: "", exists: false, error: "Archivo no encontrado" };
  }

  try {
    const content = readFileSync(filePath, "utf8");
    return { content, exists: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { content: "", exists: false, error: `Error leyendo archivo: ${errorMsg}` };
  }
}