import type {
  ComercioExteriorInfo,
  ConceptInfo,
  CceMercancia,
} from "./xml-audit.service.js";

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function toNum(val: string | null | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function moneyDiff(a: number, b: number): number {
  return Math.abs(Math.round(a * 100) - Math.round(b * 100)) / 100;
}

type Severity = "CRITICAL" | "WARNING" | "INFO";

type FindingAdder = (
  code: string,
  severity: Severity,
  title: string,
  message: string,
  recommendedAction: string,
  evidence: { label: string; value?: string }[],
) => void;

export interface ComercioExteriorAdvancedContext {
  tipoComprobante?: string | null;
  exportacion?: string | null;
  moneda?: string | null;
  total?: string | null;
  subtotal?: string | null;
  comercioExterior: ComercioExteriorInfo | null;
  concepts: ConceptInfo[];
  addFinding: FindingAdder;
}

const SUPPORTED_VERSIONS = ["1.1", "2.0"];

export function validateComercioExteriorAdvanced(
  ctx: ComercioExteriorAdvancedContext,
): void {
  const { comercioExterior, tipoComprobante, exportacion, moneda, total, concepts, addFinding } = ctx;
  if (!comercioExterior) return;

  const ceEvidence = (extra?: { label: string; value?: string }[]): { label: string; value?: string }[] => [
    { label: "version", value: comercioExterior.version ?? "—" },
    { label: "exportacion", value: exportacion ?? "—" },
    { label: "tipoComprobante", value: tipoComprobante ?? "—" },
    { label: "moneda", value: moneda ?? "—" },
    { label: "totalCfdi", value: total ?? "—" },
    { label: "totalUSD", value: comercioExterior.totalUSD ?? "—" },
    ...(extra ?? []),
  ];

  // ── A) Estructura general ──
  // A1/A2/A3: existing COMERCIO_EXTERIOR_MISSING_VERSION, VERSION_REVIEW, MISSING_TIPO_OPERACION
  // A4: TotalUSD missing
  if (!isNonEmptyString(comercioExterior.totalUSD)) {
    addFinding(
      "COMERCIO_EXTERIOR_TOTAL_USD_MISSING",
      "WARNING",
      "TotalUSD no especificado",
      "El complemento Comercio Exterior no contiene TotalUSD.",
      "Captura el monto total en dólares USD de la operación.",
      ceEvidence(),
    );
  }

  // A5) TotalUSD non-positive
  const totalUSDNum = toNum(comercioExterior.totalUSD);
  if (totalUSDNum !== null && totalUSDNum <= 0) {
    addFinding(
      "COMERCIO_EXTERIOR_TOTAL_USD_NON_POSITIVE",
      "WARNING",
      "TotalUSD debe ser positivo",
      "TotalUSD está presente pero no es un valor positivo.",
      "Revisa que el monto en dólares sea mayor a cero.",
      ceEvidence([{ label: "totalUSD", value: comercioExterior.totalUSD ?? "—" }]),
    );
  }

  // A6) TipoCambioUSD missing
  if (!isNonEmptyString(comercioExterior.tipoCambioUSD)) {
    addFinding(
      "COMERCIO_EXTERIOR_TIPO_CAMBIO_USD_MISSING",
      "WARNING",
      "TipoCambioUSD no especificado",
      "El complemento Comercio Exterior no contiene TipoCambioUSD.",
      "Captura el tipo de cambio utilizado para convertir a USD.",
      ceEvidence(),
    );
  }

  // A7) TipoCambioUSD non-positive
  const tcUSDNum = toNum(comercioExterior.tipoCambioUSD);
  if (tcUSDNum !== null && tcUSDNum <= 0) {
    addFinding(
      "COMERCIO_EXTERIOR_TIPO_CAMBIO_USD_NON_POSITIVE",
      "WARNING",
      "TipoCambioUSD debe ser positivo",
      "TipoCambioUSD está presente pero no es un valor positivo.",
      "Revisa que el tipo de cambio sea mayor a cero.",
      ceEvidence([{ label: "tipoCambioUSD", value: comercioExterior.tipoCambioUSD ?? "—" }]),
    );
  }

  // A8) Incoterm missing
  if (!isNonEmptyString(comercioExterior.incoterm)) {
    addFinding(
      "COMERCIO_EXTERIOR_INCOTERM_MISSING_REVIEW",
      "WARNING",
      "INCOTERM no especificado",
      "El complemento Comercio Exterior no contiene Incoterm.",
      "Captura el término de comercio internacional (INCOTERM) aplicable.",
      ceEvidence(),
    );
  }

  // A9) SubDivision missing
  if (!isNonEmptyString(comercioExterior.subDivision)) {
    addFinding(
      "COMERCIO_EXTERIOR_SUBDIVISION_MISSING_REVIEW",
      "INFO",
      "Subdivisión no especificada",
      "El complemento no contiene SubDivision. Puede ser opcional según el tipo de operación.",
      "Si aplica, captura la subdivisión arancelaria correspondiente.",
      ceEvidence(),
    );
  }

  // ── B) Exportación / CFDI ──
  // B1/B2: existing EXPORTACION_02_SIN_COMERCIO_EXTERIOR / COMERCIO_EXTERIOR_WITH_EXPORTACION_01

  // B3) CCE exists but Exportacion is not "02"
  if (isNonEmptyString(exportacion) && exportacion !== "02") {
    addFinding(
      "COMERCIO_EXTERIOR_WITHOUT_EXPORTACION_02_REVIEW",
      "WARNING",
      "Comercio Exterior sin Exportacion 02",
      "El complemento Comercio Exterior está presente pero Exportacion no es 02.",
      "Revisa que el tipo de exportación sea correcto (02 = Definitiva con CCE).",
      ceEvidence([{ label: "exportacion", value: exportacion }]),
    );
  }

  // B4) TipoComprobante review
  if (tipoComprobante !== "I" && tipoComprobante !== "T") {
    addFinding(
      "COMERCIO_EXTERIOR_TIPO_COMPROBANTE_REVIEW",
      "INFO",
      "Tipo de comprobante no esperado con Comercio Exterior",
      "El CFDI con Comercio Exterior no es de tipo Ingreso ni Traslado.",
      "Confirma que el tipo de comprobante sea correcto para operaciones de comercio exterior.",
      ceEvidence(),
    );
  }

  // B5) Moneda MXN with TipoCambioUSD present
  if (moneda === "MXN" && isNonEmptyString(comercioExterior.tipoCambioUSD)) {
    addFinding(
      "COMERCIO_EXTERIOR_MONEDA_MXN_WITH_TIPO_CAMBIO_REVIEW",
      "INFO",
      "Moneda MXN con TipoCambioUSD presente",
      "El CFDI está en MXN pero se especificó TipoCambioUSD. Puede ser válido si la operación se convirtió.",
      "Revisa si el tipo de cambio y la moneda del CFDI son consistentes.",
      ceEvidence([{ label: "tipoCambioUSD", value: comercioExterior.tipoCambioUSD ?? "—" }]),
    );
  }

  // B6) Moneda USD: TotalUSD vs Total CFDI mismatch
  if (moneda === "USD" && totalUSDNum !== null && isNonEmptyString(total)) {
    const totalNum = toNum(total);
    if (totalNum !== null && moneyDiff(totalUSDNum, totalNum) > 0.01) {
      addFinding(
        "COMERCIO_EXTERIOR_TOTAL_USD_VS_CFDI_TOTAL_REVIEW",
        "WARNING",
        "TotalUSD no coincide con total del CFDI (USD)",
        "La moneda del CFDI es USD pero TotalUSD difiere del total del comprobante.",
        "Revisa que el TotalUSD en el complemento coincida con el total del CFDI.",
        ceEvidence([
          { label: "totalCfdi", value: total },
          { label: "totalUSD", value: comercioExterior.totalUSD ?? "—" },
          { label: "difference", value: String(moneyDiff(totalUSDNum, totalNum)) },
        ]),
      );
    }
  }

  // B7) Moneda MXN: Estimated USD from Total vs TotalUSD
  if (moneda === "MXN" && tcUSDNum !== null && tcUSDNum > 0 && totalUSDNum !== null && isNonEmptyString(total)) {
    const totalNum = toNum(total);
    if (totalNum !== null) {
      const estimatedUSD = totalNum / tcUSDNum;
      const diff = Math.abs(estimatedUSD - totalUSDNum);
      if (diff > 1.0) {
        addFinding(
          "COMERCIO_EXTERIOR_TOTAL_USD_CONVERTED_REVIEW",
          "INFO",
          "TotalUSD estimado vs declarado difiere",
          "El TotalUSD estimado (Total CFDI / TipoCambioUSD) difiere del TotalUSD declarado en más de 1 USD.",
          "Revisa si los montos consideran cargos adicionales o si el tipo de cambio es correcto.",
          ceEvidence([
            { label: "totalCfdi", value: total },
            { label: "tipoCambioUSD", value: comercioExterior.tipoCambioUSD ?? "—" },
            { label: "estimatedUSD", value: estimatedUSD.toFixed(2) },
            { label: "totalUSDDeclared", value: comercioExterior.totalUSD ?? "—" },
          ]),
        );
      }
    }
  }

  // ── C) Certificado de origen / exportador ──

  // C1) CertificadoOrigen missing
  if (!isNonEmptyString(comercioExterior.certificadoOrigen)) {
    addFinding(
      "COMERCIO_EXTERIOR_CERT_ORIGEN_MISSING_REVIEW",
      "WARNING",
      "Certificado de origen no especificado",
      "El complemento no contiene CertificadoOrigen.",
      "Captura si existe o no certificado de origen para la operación.",
      ceEvidence(),
    );
  }

  // C2) CertificadoOrigen = 1 without NumCertificadoOrigen
  if (
    isNonEmptyString(comercioExterior.certificadoOrigen) &&
    comercioExterior.certificadoOrigen === "1" &&
    !isNonEmptyString(comercioExterior.numCertificadoOrigen)
  ) {
    addFinding(
      "COMERCIO_EXTERIOR_CERT_ORIGEN_1_WITHOUT_NUM_CERT",
      "WARNING",
      "Certificado de origen sin número",
      "Se indicó CertificadoOrigen = 1 pero no se especificó NumCertificadoOrigen.",
      "Captura el número de certificado de origen correspondiente.",
      ceEvidence([
        { label: "certificadoOrigen", value: comercioExterior.certificadoOrigen },
        { label: "numCertificadoOrigen", value: comercioExterior.numCertificadoOrigen ?? "—" },
      ]),
    );
  }

  // C3) CertificadoOrigen = 0 with NumCertificadoOrigen
  if (
    isNonEmptyString(comercioExterior.certificadoOrigen) &&
    comercioExterior.certificadoOrigen === "0" &&
    isNonEmptyString(comercioExterior.numCertificadoOrigen)
  ) {
    addFinding(
      "COMERCIO_EXTERIOR_CERT_ORIGEN_0_WITH_NUM_CERT_REVIEW",
      "INFO",
      "Certificado de origen negativo con número presente",
      "CertificadoOrigen es 0 (no aplica) pero se especificó NumCertificadoOrigen.",
      "Revisa si el certificado de origen es realmente aplicable o si el número debe eliminarse.",
      ceEvidence([
        { label: "certificadoOrigen", value: comercioExterior.certificadoOrigen },
        { label: "numCertificadoOrigen", value: comercioExterior.numCertificadoOrigen ?? "—" },
      ]),
    );
  }

  // C4) NumeroExportadorConfiable format review
  if (isNonEmptyString(comercioExterior.numeroExportadorConfiable)) {
    const nec = comercioExterior.numeroExportadorConfiable!.trim();
    if (nec.length < 3 || /\s{2,}/.test(nec)) {
      addFinding(
        "COMERCIO_EXTERIOR_EXPORTADOR_CONFIABLE_FORMAT_REVIEW",
        "INFO",
        "Formato de exportador confiable a revisar",
        "El número de exportador confiable tiene un formato inusual (muy corto o espacios).",
        "Revisa que el número de exportador confiable sea correcto.",
        ceEvidence([
          { label: "numeroExportadorConfiable", value: nec },
        ]),
      );
    }
  }

  // ── D) Emisor/Receptor/Destinatario ──

  // D1) Receptor missing ResidenciaFiscal
  if (!comercioExterior.receptor || !isNonEmptyString(comercioExterior.receptor.residenciaFiscal)) {
    addFinding(
      "COMERCIO_EXTERIOR_RECEPTOR_MISSING_RESIDENCIA_FISCAL",
      "WARNING",
      "Receptor sin residencia fiscal",
      "El receptor en Comercio Exterior no especifica ResidenciaFiscal.",
      "Captura el país de residencia fiscal del receptor.",
      ceEvidence(),
    );
  }

  // D2) Receptor missing NumRegIdTrib
  if (!comercioExterior.receptor || !isNonEmptyString(comercioExterior.receptor.numRegIdTrib)) {
    addFinding(
      "COMERCIO_EXTERIOR_RECEPTOR_MISSING_NUM_REG_ID_TRIB",
      "WARNING",
      "Receptor sin NumRegIdTrib",
      "El receptor en Comercio Exterior no especifica NumRegIdTrib.",
      "Captura el número de identificación o registro fiscal del receptor.",
      ceEvidence(),
    );
  }

  // D3) Receptor MX with NumRegIdTrib
  if (
    comercioExterior.receptor &&
    isNonEmptyString(comercioExterior.receptor.residenciaFiscal) &&
    comercioExterior.receptor.residenciaFiscal!.toLowerCase() === "mx" &&
    isNonEmptyString(comercioExterior.receptor.numRegIdTrib)
  ) {
    addFinding(
      "COMERCIO_EXTERIOR_RECEPTOR_MX_WITH_NUM_REG_ID_TRIB_REVIEW",
      "INFO",
      "Receptor MX con NumRegIdTrib",
      "El receptor tiene residencia fiscal MX pero se especificó NumRegIdTrib.",
      "Revisa si el receptor debe tener residencia fiscal en el extranjero o si el NumRegIdTrib es correcto.",
      ceEvidence([
        { label: "residenciaFiscal", value: comercioExterior.receptor.residenciaFiscal ?? "—" },
        { label: "numRegIdTrib", value: comercioExterior.receptor.numRegIdTrib ?? "—" },
      ]),
    );
  }

  // D4) Receptor domicilio missing Pais
  if (comercioExterior.receptor?.domicilio && !isNonEmptyString(comercioExterior.receptor.domicilio.pais)) {
    addFinding(
      "COMERCIO_EXTERIOR_RECEPTOR_DOMICILIO_MISSING_PAIS",
      "WARNING",
      "Domicilio del receptor sin país",
      "El domicilio del receptor en Comercio Exterior no especifica el país.",
      "Captura el país del domicilio del receptor.",
      ceEvidence(),
    );
  }

  // D5) Receptor domicilio missing CodigoPostal
  if (comercioExterior.receptor?.domicilio && !isNonEmptyString(comercioExterior.receptor.domicilio.codigoPostal)) {
    addFinding(
      "COMERCIO_EXTERIOR_RECEPTOR_DOMICILIO_MISSING_CP_REVIEW",
      "INFO",
      "Domicilio del receptor sin código postal",
      "El domicilio del receptor no contiene código postal.",
      "Si aplica, captura el código postal del domicilio del receptor.",
      ceEvidence(),
    );
  }

  // D6) Destinatario domicilio missing Pais
  if ((comercioExterior.destinatarios ?? []).length > 0) {
    (comercioExterior.destinatarios ?? []).forEach((dest, dIdx) => {
      const destNum = dIdx + 1;
      if (dest.domicilio && !isNonEmptyString(dest.domicilio.pais)) {
        addFinding(
          "COMERCIO_EXTERIOR_DESTINATARIO_DOMICILIO_MISSING_PAIS",
          "WARNING",
          "Domicilio del destinatario sin país",
          "El domicilio de un destinatario en Comercio Exterior no especifica el país.",
          "Captura el país del domicilio del destinatario.",
          ceEvidence([{ label: "destinatarioIndex", value: String(destNum) }]),
        );
      }
    });
  }

  // D7) Emisor domicilio missing Pais
  if (comercioExterior.emisor?.domicilio && !isNonEmptyString(comercioExterior.emisor.domicilio.pais)) {
    addFinding(
      "COMERCIO_EXTERIOR_EMISOR_DOMICILIO_MISSING_PAIS_REVIEW",
      "INFO",
      "Domicilio del emisor sin país",
      "El domicilio del emisor en Comercio Exterior no especifica el país.",
      "Si aplica, captura el país del domicilio del emisor.",
      ceEvidence(),
    );
  }

  // ── E) Mercancías ──

  // E1) Without mercancias
  if (comercioExterior.mercancias.length === 0) {
    addFinding(
      "COMERCIO_EXTERIOR_WITHOUT_MERCANCIAS",
      "WARNING",
      "Comercio Exterior sin mercancías",
      "El complemento no contiene nodos Mercancia.",
      "Captura al menos una mercancía en el complemento de comercio exterior.",
      ceEvidence(),
    );
    return;
  }

  // Per-mercancía rules
  const conceptNoIds = new Set(concepts.map((c) => c.noIdentificacion).filter(Boolean));

  let sumValorDolares = 0;

  comercioExterior.mercancias.forEach((mer, mIdx) => {
    const merNum = mIdx + 1;
    const merEvidence = (extra?: { label: string; value?: string }[]): { label: string; value?: string }[] => [
      { label: "mercanciaIndex", value: String(merNum) },
      { label: "noIdentificacion", value: mer.noIdentificacion ?? "—" },
      { label: "fraccionArancelaria", value: mer.fraccionArancelaria ?? "—" },
      { label: "cantidadAduana", value: mer.cantidadAduana ?? "—" },
      { label: "unidadAduana", value: mer.unidadAduana ?? "—" },
      { label: "valorUnitarioAduana", value: mer.valorUnitarioAduana ?? "—" },
      { label: "valorDolares", value: mer.valorDolares ?? "—" },
      ...(extra ?? []),
    ];

    // E2) Missing NoIdentificacion
    if (!isNonEmptyString(mer.noIdentificacion)) {
      addFinding(
        "COMERCIO_EXTERIOR_MERCANCIA_MISSING_NO_IDENTIFICACION",
        "WARNING",
        "Mercancía sin NoIdentificacion",
        "Una mercancía no contiene NoIdentificacion.",
        "Revisa el número de identificación de la mercancía.",
        ceEvidence(merEvidence()),
      );
    }

    // E3) Missing FraccionArancelaria
    if (!isNonEmptyString(mer.fraccionArancelaria)) {
      addFinding(
        "COMERCIO_EXTERIOR_MERCANCIA_MISSING_FRACCION_ARANCELARIA",
        "WARNING",
        "Mercancía sin FraccionArancelaria",
        "Una mercancía no contiene FraccionArancelaria.",
        "Captura la fracción arancelaria de la mercancía.",
        ceEvidence(merEvidence()),
      );
    }

    // E4) FraccionArancelaria format review
    if (isNonEmptyString(mer.fraccionArancelaria)) {
      const fa = mer.fraccionArancelaria!.trim();
      if (fa.length !== 8 || !/^\d+$/.test(fa)) {
        addFinding(
          "COMERCIO_EXTERIOR_MERCANCIA_FRACCION_FORMAT_REVIEW",
          "INFO",
          "Formato de fracción arancelaria a revisar",
          "La fracción arancelaria no tiene 8 dígitos numéricos.",
          "Revisa que la fracción arancelaria cumpla con el formato de 8 dígitos.",
          ceEvidence(merEvidence()),
        );
      }
    }

    // E5) CantidadAduana non-positive
    const cantAdu = toNum(mer.cantidadAduana);
    if (cantAdu !== null && cantAdu <= 0) {
      addFinding(
        "COMERCIO_EXTERIOR_MERCANCIA_CANTIDAD_ADUANA_NON_POSITIVE",
        "WARNING",
        "CantidadAduana no positiva",
        "La cantidad aduana de una mercancía no es un valor positivo.",
        "Revisa que la cantidad aduana sea mayor a cero.",
        ceEvidence(merEvidence()),
      );
    }

    // E6) Missing UnidadAduana
    if (!isNonEmptyString(mer.unidadAduana)) {
      addFinding(
        "COMERCIO_EXTERIOR_MERCANCIA_MISSING_UNIDAD_ADUANA",
        "WARNING",
        "Mercancía sin UnidadAduana",
        "Una mercancía no contiene UnidadAduana.",
        "Captura la unidad de medida aduana de la mercancía.",
        ceEvidence(merEvidence()),
      );
    }

    // E7) ValorUnitarioAduana non-positive
    const vuAdu = toNum(mer.valorUnitarioAduana);
    if (vuAdu !== null && vuAdu <= 0) {
      addFinding(
        "COMERCIO_EXTERIOR_MERCANCIA_VALOR_UNITARIO_NON_POSITIVE",
        "WARNING",
        "ValorUnitarioAduana no positivo",
        "El valor unitario aduana de una mercancía no es un valor positivo.",
        "Revisa que el valor unitario aduana sea mayor a cero.",
        ceEvidence(merEvidence()),
      );
    }

    // E8) ValorDolares non-positive
    const vdNum = toNum(mer.valorDolares);
    if (vdNum !== null && vdNum <= 0) {
      addFinding(
        "COMERCIO_EXTERIOR_MERCANCIA_VALOR_DOLARES_NON_POSITIVE",
        "WARNING",
        "ValorDolares no positivo",
        "El valor en dólares de una mercancía no es un valor positivo.",
        "Revisa que el valor en dólares sea mayor a cero.",
        ceEvidence(merEvidence()),
      );
    }

    // E9) ValorDolares mismatch: CantidadAduana * ValorUnitarioAduana vs ValorDolares
    if (cantAdu !== null && vuAdu !== null && vdNum !== null) {
      const calculatedVd = cantAdu * vuAdu;
      if (moneyDiff(calculatedVd, vdNum) > 0.01) {
        addFinding(
          "COMERCIO_EXTERIOR_MERCANCIA_VALOR_DOLARES_MISMATCH",
          "WARNING",
          "ValorDolares no coincide con CantidadAduana * ValorUnitarioAduana",
          "El valor en dólares de una mercancía difiere del cálculo esperado.",
          "Revisa que CantidadAduana, ValorUnitarioAduana y ValorDolares sean consistentes.",
          ceEvidence(merEvidence([
            { label: "calculated", value: String(calculatedVd) },
          ])),
        );
      }
    }

    // Sum for E10
    if (vdNum !== null) {
      sumValorDolares += vdNum;
    }

    // E11) Mercancia noIdentificacion not in concepts
    if (isNonEmptyString(mer.noIdentificacion) && conceptNoIds.size > 0) {
      if (!conceptNoIds.has(mer.noIdentificacion)) {
        addFinding(
          "COMERCIO_EXTERIOR_MERCANCIA_NOT_IN_CONCEPTS_REVIEW",
          "INFO",
          "Mercancía no identificada en conceptos del CFDI",
          "El NoIdentificacion de una mercancía del complemento no aparece en los conceptos del CFDI.",
          "Revisa que las mercancías del complemento correspondan a las del CFDI.",
          ceEvidence(merEvidence()),
        );
      }
    }
  });

  // E10) TotalUSD vs sum of ValorDolares
  if (totalUSDNum !== null && sumValorDolares > 0 && moneyDiff(totalUSDNum, sumValorDolares) > 0.01) {
    addFinding(
      "COMERCIO_EXTERIOR_TOTAL_USD_MERCANCIAS_MISMATCH",
      "WARNING",
      "TotalUSD no coincide con suma de ValorDolares",
      "El TotalUSD declarado difiere de la suma de los valores en dólares de las mercancías.",
      "Revisa que el TotalUSD sea consistente con la suma de los valores de las mercancías.",
      ceEvidence([
        { label: "totalUSDDeclared", value: comercioExterior.totalUSD ?? "—" },
        { label: "sumaValorDolares", value: String(sumValorDolares) },
      ]),
    );
  }

  // E12) Concept with NoIdentificacion not in CCE mercancias
  if (comercioExterior.mercancias.length > 0 && conceptNoIds.size > 0) {
    const merNoIds = new Set(comercioExterior.mercancias.map((m) => m.noIdentificacion).filter(Boolean));
    for (const cNoId of conceptNoIds) {
      if (cNoId && !merNoIds.has(cNoId)) {
        addFinding(
          "COMERCIO_EXTERIOR_CONCEPT_WITHOUT_MERCANCIA_REVIEW",
          "INFO",
          "Concepto del CFDI sin mercancía en Comercio Exterior",
          "Un concepto con NoIdentificacion no aparece como mercancía en el complemento CCE.",
          "Revisa que todos los conceptos del CFDI estén reflejados en las mercancías del complemento.",
          ceEvidence([{ label: "conceptNoIdentificacion", value: cNoId }]),
        );
      }
    }
  }
}
