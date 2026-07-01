import type { XsdValidationSummary } from "./xsd-validation.types.js";

const MAX_SCHEMA_LOCATION_LENGTH = 200;
const MAX_WARNINGS_ERRORS = 20;
const MAX_SCHEMAS = 50;

function sanitizeSchemaLocation(location: string): string {
  if (location.length > MAX_SCHEMA_LOCATION_LENGTH) {
    return location.slice(0, MAX_SCHEMA_LOCATION_LENGTH) + "...";
  }
  return location;
}

function truncateString(str: string, max: number): string {
  if (str.length > max) {
    return str.slice(0, max) + "...";
  }
  return str;
}

export function sanitizeXsdValidationSummary(summary: XsdValidationSummary): XsdValidationSummary {
  return {
    ...summary,
    schemaLocationPairs: summary.schemaLocationPairs
      .map((p) => ({
        namespaceUri: p.namespaceUri,
        location: sanitizeSchemaLocation(p.location),
      }))
      .slice(0, MAX_SCHEMAS),
    warnings: summary.warnings.map((w) => truncateString(w, MAX_SCHEMA_LOCATION_LENGTH)).slice(0, MAX_WARNINGS_ERRORS),
    errors: summary.errors.map((e) => truncateString(e, MAX_SCHEMA_LOCATION_LENGTH)).slice(0, MAX_WARNINGS_ERRORS),
    schemas: summary.schemas.slice(0, MAX_SCHEMAS),
  };
}