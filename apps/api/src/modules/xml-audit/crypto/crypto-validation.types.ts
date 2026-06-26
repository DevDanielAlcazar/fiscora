export type CryptoValidationStatus =
  | "NOT_CONFIGURED"
  | "SKIPPED_MISSING_ASSET"
  | "METADATA_ONLY"
  | "VALID"
  | "INVALID"
  | "ERROR";

export type CryptoValidationAssetType =
  | "CFDI_CADENA_ORIGINAL_XSLT"
  | "TFD_CADENA_ORIGINAL_XSLT"
  | "TRUSTED_SAT_CERTIFICATE"
  | "TRUSTED_PAC_CERTIFICATE"
  | "UNKNOWN";

export type CryptoValidationCheckKey =
  | "CFDI_ORIGINAL_CHAIN"
  | "CFDI_SELLO"
  | "CFDI_CERTIFICATE"
  | "CFDI_CERTIFICATE_SERIAL"
  | "CFDI_CERTIFICATE_VALIDITY"
  | "CFDI_CERTIFICATE_RFC_MATCH"
  | "TFD_ORIGINAL_CHAIN"
  | "TFD_SELLO_SAT"
  | "TFD_CERTIFICATE_SAT"
  | "PAC_RFC_PROVIDER"
  | "UNKNOWN";

export interface CryptoAssetDefinition {
  key: string;
  type: CryptoValidationAssetType;
  displayName: string;
  localPath?: string;
  configured: boolean;
  requiredFor: CryptoValidationCheckKey[];
  notes?: string[];
}

export interface CertificateSafeMetadata {
  present: boolean;
  parseable: boolean;
  serialNumber?: string;
  subjectSummary?: string;
  issuerSummary?: string;
  validFrom?: string;
  validTo?: string;
  fingerprintSha256?: string;
  publicKeyAlgorithm?: string;
  error?: string;
}

export interface CryptoValidationCheckResult {
  key: CryptoValidationCheckKey;
  status: CryptoValidationStatus;
  configured: boolean;
  validated: boolean;
  message: string;
  evidence?: Record<string, unknown>;
}

export interface CryptoValidationSummary {
  enabled: boolean;
  status: CryptoValidationStatus;
  adapterName: string;
  configuredAssets: number;
  requiredAssets: string[];
  checks: CryptoValidationCheckResult[];
  cfdiCertificate?: CertificateSafeMetadata;
  satCertificate?: CertificateSafeMetadata;
  notes: string[];
  durationMs?: number;
}