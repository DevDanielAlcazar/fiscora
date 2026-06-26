export type XsdValidationStatus =
  | "NOT_CONFIGURED"
  | "SKIPPED_NO_SCHEMA"
  | "VALID"
  | "INVALID"
  | "ERROR";

export type XsdSchemaKey =
  | "CFDI_40"
  | "TFD_11"
  | "PAGOS_20"
  | "NOMINA_12"
  | "CARTA_PORTE_30"
  | "CARTA_PORTE_31"
  | "COMERCIO_EXTERIOR_20"
  | "RETENCIONES_20"
  | "IMPUESTOS_LOCALES"
  | "LEYENDAS_FISCALES"
  | "DONATARIAS"
  | "UNKNOWN";

export interface XsdSchemaDefinition {
  key: XsdSchemaKey;
  module: string;
  displayName: string;
  expectedNamespace?: string;
  localPath?: string;
  required: boolean;
  configured: boolean;
  notes?: string[];
}

export interface XsdValidationIssue {
  severity: "ERROR" | "WARNING" | "INFO";
  line?: number;
  column?: number;
  code?: string;
  message: string;
  path?: string;
}

export interface XsdValidationResult {
  status: XsdValidationStatus;
  schemaKey: XsdSchemaKey;
  schemaName: string;
  configured: boolean;
  validated: boolean;
  issues: XsdValidationIssue[];
  notes: string[];
  durationMs?: number;
}

export interface XsdValidationSummary {
  enabled: boolean;
  configuredSchemas: number;
  detectedSchemas: string[];
  validatedSchemas: number;
  validSchemas: number;
  invalidSchemas: number;
  skippedSchemas: number;
  status: XsdValidationStatus;
  results: XsdValidationResult[];
}