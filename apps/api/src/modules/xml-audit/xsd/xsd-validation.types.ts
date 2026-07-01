export type XsdValidationStatus =
  | "NOT_CONFIGURED"
  | "PENDING_SCHEMA_ASSETS"
  | "READY_NOT_EXECUTED"
  | "EXECUTED"
  | "FAILED";

export type XsdSchemaCoverageStatus =
  | "MISSING_LOCAL_ASSET"
  | "LOCAL_ASSET_PRESENT"
  | "OPTIONAL"
  | "UNKNOWN_NAMESPACE";

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
  optional?: boolean;
  notes?: string[];
}

export interface XsdSchemaPreflightEntry {
  schemaKey: XsdSchemaKey;
  displayName: string;
  namespaceUri: string;
  detected: boolean;
  declaredInSchemaLocation: boolean;
  localAssetPresent: boolean;
  coverageStatus: XsdSchemaCoverageStatus;
  expectedLocalPath?: string;
}

export interface XsdValidationSummary {
  status: XsdValidationStatus;
  formalValidationExecuted: boolean;
  formalValidationAvailable: boolean;
  adapterName?: string;
  schemasConfigured: number;
  schemasDetected: number;
  schemasWithLocalAssets: number;
  schemasMissingLocalAssets: number;
  detectedSchemas: string[];
  namespacesDetected: string[];
  schemaLocationDeclared: boolean;
  schemaLocationPairs: Array<{
    namespaceUri: string;
    location: string;
  }>;
  schemas: XsdSchemaPreflightEntry[];
  warnings: string[];
  errors: string[];
}