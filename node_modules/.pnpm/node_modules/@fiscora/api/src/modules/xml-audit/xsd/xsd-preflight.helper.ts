import type { XsdSchemaDefinition } from "./xsd-schema.registry.js";
import { XSD_SCHEMA_REGISTRY } from "./xsd-schema.registry.js";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { XsdValidationSummary } from "./xsd-validation.types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const XSD_ASSETS_BASE = join(__dirname, "assets");

const SCHEMA_LOCATION_REGEX = /schemaLocation\s*=\s*["']([^"']*)["']/gi;
const NAMESPACE_REGEX = /xmlns:([a-zA-Z0-9_]+)\s*=\s*["']([^"']*)["']/gi;
const XSD_NAMESPACE_REGEX = /xmlns\s*=\s*["']([^"']*)["']/gi;

export function extractSchemaLocationPairs(
  xml: string,
): Array<{ namespaceUri: string; location: string }> {
  const pairs: Array<{ namespaceUri: string; location: string }> = [];
  let match;

  while ((match = SCHEMA_LOCATION_REGEX.exec(xml)) !== null) {
    const value = match[1];
    const parts = value.split(/\s+/);
    for (let i = 0; i < parts.length - 1; i += 2) {
      if (parts[i] && parts[i + 1]) {
        pairs.push({ namespaceUri: parts[i], location: parts[i + 1] });
      }
    }
  }

  return pairs;
}

export function detectNamespacesForXsd(xml: string): string[] {
  const namespaces = new Set<string>();

  let match;
  while ((match = NAMESPACE_REGEX.exec(xml)) !== null) {
    if (match[2]) namespaces.add(match[2]);
  }

  while ((match = XSD_NAMESPACE_REGEX.exec(xml)) !== null) {
    if (match[1]) namespaces.add(match[1]);
  }

  return Array.from(namespaces);
}

function hasLocalAsset(expectedPath?: string): boolean {
  if (!expectedPath) return false;
  try {
    return existsSync(join(XSD_ASSETS_BASE, expectedPath));
  } catch {
    return false;
  }
}

export function sanitizeSchemaLocation(location: string): string {
  const max = 200;
  if (location.length > max) {
    return location.slice(0, max) + "...";
  }
  return location;
}

export function buildXsdPreflightSummary(
  xml: string,
  knownComplements: string[] = [],
): XsdValidationSummary {
  const schemaLocationPairs = extractSchemaLocationPairs(xml);
  const detectedNamespaces = detectNamespacesForXsd(xml);

  const registry = XSD_SCHEMA_REGISTRY;
  const schemas = registry.map((def: XsdSchemaDefinition) => {
    const namespaceDetected = detectedNamespaces.includes(def.expectedNamespace ?? "");
    const hasAsset = hasLocalAsset(def.localPath);

    let coverageStatus: "MISSING_LOCAL_ASSET" | "LOCAL_ASSET_PRESENT" | "OPTIONAL" | "UNKNOWN_NAMESPACE" = "OPTIONAL";
    if (namespaceDetected) {
      coverageStatus = hasAsset ? "LOCAL_ASSET_PRESENT" : "MISSING_LOCAL_ASSET";
    }

    return {
      schemaKey: def.key,
      displayName: def.displayName,
      namespaceUri: def.expectedNamespace ?? "",
      detected: namespaceDetected,
      declaredInSchemaLocation: schemaLocationPairs.some((p) => p.namespaceUri === def.expectedNamespace),
      localAssetPresent: hasAsset,
      coverageStatus,
      expectedLocalPath: def.localPath,
    };
  });

  const schemasDetected = schemas.filter((s) => s.detected).length;
  const schemasWithAssets = schemas.filter((s) => s.localAssetPresent).length;
  const schemasMissingAssets = schemasDetected - schemasWithAssets;

  const hasAssetsFolder = existsSync(XSD_ASSETS_BASE);
  const status: "NOT_CONFIGURED" | "PENDING_SCHEMA_ASSETS" | "READY_NOT_EXECUTED" = hasAssetsFolder
    ? schemasMissingAssets > 0
      ? "READY_NOT_EXECUTED"
      : "NOT_CONFIGURED"
    : "PENDING_SCHEMA_ASSETS";

  const warnings: string[] = [];
  const errors: string[] = [];

  if (status === "PENDING_SCHEMA_ASSETS") {
    warnings.push("Validación XSD formal pendiente: no hay schemas locales configurados.");
  }

  return {
    status,
    formalValidationExecuted: false,
    formalValidationAvailable: false,
    schemasConfigured: registry.length,
    schemasDetected,
    schemasWithLocalAssets: schemasWithAssets,
    schemasMissingLocalAssets: schemasMissingAssets,
    detectedSchemas: schemas.filter((s) => s.detected).map((s) => s.schemaKey),
    namespacesDetected: detectedNamespaces,
    schemaLocationDeclared: schemaLocationPairs.length > 0,
    schemaLocationPairs: schemaLocationPairs.map((p) => ({
      namespaceUri: p.namespaceUri,
      location: sanitizeSchemaLocation(p.location),
    })),
    schemas: schemas,
    warnings,
    errors,
  };
}