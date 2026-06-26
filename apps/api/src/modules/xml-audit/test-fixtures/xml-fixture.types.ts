export type SyntheticFixtureKind =
  | "CFDI_BASE"
  | "PAGOS_20"
  | "NOMINA_12"
  | "CARTA_PORTE"
  | "COMERCIO_EXTERIOR"
  | "RETENCIONES_20"
  | "IMPUESTOS_LOCALES"
  | "LEYENDAS_FISCALES"
  | "DONATARIAS"
  | "ADDENDA";

export type SyntheticFixtureSeverityIntent = "OK" | "INFO" | "WARNING" | "CRITICAL" | "MIXED";

export interface SyntheticFixtureCase {
  id: string;
  name: string;
  kind: SyntheticFixtureKind;
  description: string;
  xml: string;
  expectedFindingCodes?: string[];
  expectedAbsentFindingCodes?: string[];
  expectedRiskLevel?: "OK" | "WARNING" | "CRITICAL";
  expectedDocumentKind?: "CFDI" | "RETENCIONES";
  expectedComplementDetected?: boolean;
  tags: string[];
  notes?: string[];
}

export interface SyntheticFixtureBuildOptions {
  uuid?: string;
  serie?: string;
  folio?: string;
  fecha?: string;
  emisorRfc?: string;
  receptorRfc?: string;
  includeTfd?: boolean;
  namespaceMode?: "prefixed" | "unprefixed" | "mixed";
  version?: string;
}