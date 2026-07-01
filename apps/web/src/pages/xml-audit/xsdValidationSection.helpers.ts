import type { XsdValidationSummary } from "../../api/xml-audit";

export interface XsdValidationSummaryData {
  status: string;
  schemasDetected: number;
  schemasWithLocalAssets: number;
  schemasMissingLocalAssets: number;
  schemaLocationDeclared: boolean;
  namespacesDetected: string[];
}

export function buildXsdValidationSummary(
  xsdValidation?: XsdValidationSummary,
): XsdValidationSummaryData | null {
  if (!xsdValidation) return null;

  return {
    status: xsdValidation.status,
    schemasDetected: xsdValidation.schemasDetected,
    schemasWithLocalAssets: xsdValidation.schemasWithLocalAssets,
    schemasMissingLocalAssets: xsdValidation.schemasMissingLocalAssets,
    schemaLocationDeclared: xsdValidation.schemaLocationDeclared,
    namespacesDetected: xsdValidation.namespacesDetected,
  };
}