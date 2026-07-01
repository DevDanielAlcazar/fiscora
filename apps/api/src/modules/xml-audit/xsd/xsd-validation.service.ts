import type { XsdValidationSummary } from "./xsd-validation.types.js";
import { buildXsdPreflightSummary } from "./xsd-preflight.helper.js";
import { sanitizeXsdValidationSummary } from "./xsd-validation.sanitizer.js";

export function validateXmlAgainstConfiguredXsd(params: {
  xml: string;
  knownComplements?: string[];
}): XsdValidationSummary {
  const preflight = buildXsdPreflightSummary(params.xml, params.knownComplements ?? []);
  return sanitizeXsdValidationSummary(preflight);
}