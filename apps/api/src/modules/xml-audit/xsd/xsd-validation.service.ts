import type {
  XsdSchemaDefinition,
  XsdValidationResult,
  XsdValidationSummary,
  XsdValidationStatus,
} from "./xsd-validation.types.js";
import { XSD_SCHEMA_REGISTRY, getSchemaDefinition } from "./xsd-schema.registry.js";
import { XSD_ADAPTER, type XsdValidationAdapter } from "./xsd-validation.adapter.js";

interface XsdDetectionParams {
  version?: string | null;
  hasTimbreFiscalDigital: boolean;
  hasPaymentComplement: boolean;
  hasNomina: boolean;
  hasCartaPorte?: { detected: boolean; hasAutotransporte: boolean };
  hasComercioExterior: boolean;
  hasRetenciones: boolean;
  hasImpuestosLocales: boolean;
  hasLeyendasFiscales: boolean;
  hasDonatarias: boolean;
}

export function detectRequiredSchemas(params: XsdDetectionParams): XsdSchemaDefinition[] {
  const schemas: XsdSchemaDefinition[] = [];

  if (params.version === "4.0") {
    const cfdi40 = getSchemaDefinition("CFDI_40");
    if (cfdi40) schemas.push(cfdi40);
  }

  if (params.hasTimbreFiscalDigital) {
    const tfd = getSchemaDefinition("TFD_11");
    if (tfd) schemas.push(tfd);
  }

  if (params.hasPaymentComplement) {
    const pagos = getSchemaDefinition("PAGOS_20");
    if (pagos) schemas.push(pagos);
  }

  if (params.hasNomina) {
    const nomina = getSchemaDefinition("NOMINA_12");
    if (nomina) schemas.push(nomina);
  }

  if (params.hasCartaPorte?.detected) {
    const cp = getSchemaDefinition("CARTA_PORTE_30");
    if (cp) schemas.push(cp);
  }

  if (params.hasComercioExterior) {
    const cce = getSchemaDefinition("COMERCIO_EXTERIOR_20");
    if (cce) schemas.push(cce);
  }

  if (params.hasRetenciones) {
    const ret = getSchemaDefinition("RETENCIONES_20");
    if (ret) schemas.push(ret);
  }

  if (params.hasImpuestosLocales) {
    const il = getSchemaDefinition("IMPUESTOS_LOCALES");
    if (il) schemas.push(il);
  }

  if (params.hasLeyendasFiscales) {
    const lf = getSchemaDefinition("LEYENDAS_FISCALES");
    if (lf) schemas.push(lf);
  }

  if (params.hasDonatarias) {
    const don = getSchemaDefinition("DONATARIAS");
    if (don) schemas.push(don);
  }

  return schemas;
}

export function buildXsdValidationSummary(
  _xmlContent: string | undefined,
  detection: XsdDetectionParams,
  enableXsdValidation = false,
): XsdValidationSummary {
  const detectedSchemas = detectRequiredSchemas(detection);
  const adapter = XSD_ADAPTER;

  if (!enableXsdValidation || !adapter.available()) {
    const results = detectedSchemas.map((schema) => ({
      status: "NOT_CONFIGURED" as XsdValidationStatus,
      schemaKey: schema.key,
      schemaName: schema.displayName,
      configured: schema.configured,
      validated: false,
      issues: [],
      notes: ["Validación XSD no configurada en este entorno."],
    }));

    return {
      enabled: enableXsdValidation,
      configuredSchemas: 0,
      detectedSchemas: detectedSchemas.map((s) => s.key),
      validatedSchemas: 0,
      validSchemas: 0,
      invalidSchemas: 0,
      skippedSchemas: detectedSchemas.length,
      status: "NOT_CONFIGURED",
      results,
    };
  }

  const results = detectedSchemas
    .map((schema) => adapter.validate("", schema))
    .filter((r): r is XsdValidationResult => r !== undefined);

  const configuredCount = results.filter((r) => r.configured).length;
  const validCount = results.filter((r) => r.status === "VALID").length;
  const invalidCount = results.filter((r) => r.status === "INVALID").length;

  const hasInvalid = results.some((r) => r.status === "INVALID");
  const status: XsdValidationStatus = hasInvalid ? "INVALID" : "VALID";

  return {
    enabled: true,
    configuredSchemas: configuredCount,
    detectedSchemas: detectedSchemas.map((s) => s.key),
    validatedSchemas: results.length,
    validSchemas: validCount,
    invalidSchemas: invalidCount,
    skippedSchemas: detectedSchemas.length - results.length,
    status,
    results,
  };
}