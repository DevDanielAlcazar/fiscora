export type CryptoPreflightStatus =
  | "NOT_APPLICABLE"
  | "PRESENT"
  | "MISSING_REQUIRED_FIELDS"
  | "FORMAT_REVIEW"
  | "CERTIFICATE_REVIEW"
  | "PENDING_FORMAL_VALIDATION";

export interface CryptoFieldPresence {
  sello: boolean;
  certificado: boolean;
  noCertificado: boolean;
  selloCfd: boolean;
  selloSat: boolean;
  noCertificadoSat: boolean;
  rfcProvCertif: boolean;
  uuid: boolean;
  fechaTimbrado: boolean;
}

export interface CryptoCertificateSummary {
  parseStatus: "NOT_PRESENT" | "PARSED" | "PARSE_FAILED";
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  serialNumber?: string;
  fingerprint256?: string;
  publicKeyAlgorithm?: string;
  notBeforeReview?: boolean;
  expiredReview?: boolean;
  noCertificadoComparison?: "MATCH" | "MISMATCH" | "NOT_COMPARABLE" | "NOT_AVAILABLE";
}

export interface CryptoPreflightSummary {
  status: CryptoPreflightStatus;
  fieldPresence: CryptoFieldPresence;

  selloLooksBase64: boolean;
  certificadoLooksBase64: boolean;
  selloCfdLooksBase64: boolean;
  selloSatLooksBase64: boolean;

  uuidFormatValid?: boolean;
  noCertificadoFormatValid?: boolean;
  noCertificadoSatFormatValid?: boolean;
  rfcProvCertifFormatValid?: boolean;

  fechaTimbradoParseable?: boolean;
  fechaTimbradoBeforeCfdiDateReview?: boolean;
  fechaTimbradoFutureReview?: boolean;

  certificado?: CryptoCertificateSummary;

  formalSealValidationExecuted: false;
  cadenaOriginalReconstructed: false;
  xsltAssetsAvailable: false;
  trustChainValidated: false;
  cryptographicSignatureVerified: false;

  warnings: string[];
  errors: string[];
}