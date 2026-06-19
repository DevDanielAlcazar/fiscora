import type {
  RetencionesInfo,
} from "./xml-audit.service.js";

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function toMoneyNumber(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function normalizeText(val: string | null | undefined): string {
  if (!val) return "";
  return val.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

export interface RetencionesAdvancedContext {
  retenciones: RetencionesInfo;
  addFinding: FindingAdder;
}

const GENERIC_RFCS = new Set(["XAXX010101000", "XEXX010101000"]);

const KNOWN_RETENCIONES_COMPLEMENTS = new Set([
  "TimbreFiscalDigital",
  "Dividendos",
  "Intereses",
  "PagosExtranjeros",
  "Pagos",
  "CartaPorte",
  "Nomina",
  "ComercioExterior",
  "ImpuestosLocales",
  "LeyendasFiscales",
  "Donatarias",
  "Addenda",
]);

export function validateRetencionesAdvanced(ctx: RetencionesAdvancedContext): void {
  const { retenciones, addFinding } = ctx;
  if (!retenciones) return;

  const {
    version,
    lugarExpRetenc,
    cveRetenc,
    descRetenc,
    emisor,
    receptor,
    periodo,
    totales,
    complementoNames,
    uuid,
    folioInt,
  } = retenciones;

  const isVersion20 = isNonEmptyString(version) && version.startsWith("2.");
  const isNacional =
    !receptor?.nacionalidad ||
    normalizeText(receptor.nacionalidad).toUpperCase() !== "EXTRANJERO";

  // ── A) Version, Fecha, Lugar, Claves ──
  // A1-DETECTED → exists in service
  // A2-MISSING_VERSION → exists in service
  // A3-MISSING_FECHA_EXP → exists in service
  // A4-FECHA_EXP_INVALID → exists in service

  // A5) RETENCIONES_LUGAR_EXP_MISSING
  if (!isNonEmptyString(lugarExpRetenc)) {
    addFinding(
      "RETENCIONES_LUGAR_EXP_MISSING",
      "WARNING",
      "Lugar de expedición de Retenciones faltante",
      "No se detectó LugarExpRetenc en el XML de Retenciones.",
      "Revisa el lugar de expedición del documento.",
      [
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "CveRetenc", value: cveRetenc ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // A6-MISSING_CVE_RETENC → exists in service

  // A7) RETENCIONES_DESC_RETENC_MISSING_REVIEW
  if (isNonEmptyString(cveRetenc) && !isNonEmptyString(descRetenc)) {
    addFinding(
      "RETENCIONES_DESC_RETENC_MISSING_REVIEW",
      "INFO",
      "Descripción de retención faltante",
      "CveRetenc está presente pero DescRetenc está vacío.",
      "Verifica que la descripción del tipo de retención esté completa.",
      [
        { label: "CveRetenc", value: cveRetenc },
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // A8-CERTIFICATE_FIELDS → exists in service as MISSING_SELLO_OR_CERT_REVIEW

  // ── B) Emisor ──
  // B1-MISSING_EMISOR_RFC → exists in service

  // B2) RETENCIONES_EMISOR_NAME_MISSING
  if (emisor && !isNonEmptyString(emisor.nombre)) {
    addFinding(
      "RETENCIONES_EMISOR_NAME_MISSING",
      "WARNING",
      "Nombre del emisor faltante",
      "No se detectó el nombre del emisor en el XML de Retenciones.",
      "Revisa la información del emisor.",
      [
        { label: "RFC emisor", value: emisor.rfcEmisor ?? "—" },
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // B3) RETENCIONES_EMISOR_REGIMEN_MISSING
  if (isVersion20 && emisor && !isNonEmptyString(emisor.regimenFiscalE)) {
    addFinding(
      "RETENCIONES_EMISOR_REGIMEN_MISSING",
      "WARNING",
      "Régimen fiscal del emisor faltante",
      "Versión 2.0 requiere RegimenFiscalE en el nodo Emisor de Retenciones.",
      "Agrega el régimen fiscal del emisor.",
      [
        { label: "RFC emisor", value: emisor.rfcEmisor ?? "—" },
        { label: "Nombre emisor", value: emisor.nombre ?? "—" },
        { label: "Versión", value: version ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // B4-EMISOR_RFC_FORMAT_REVIEW → exists in service

  // ── C) Receptor ──
  // C1) RETENCIONES_RECEPTOR_NACIONALIDAD_MISSING
  if (receptor && !isNonEmptyString(receptor.nacionalidad)) {
    addFinding(
      "RETENCIONES_RECEPTOR_NACIONALIDAD_MISSING",
      "WARNING",
      "Nacionalidad del receptor faltante",
      "No se detectó la nacionalidad del receptor en Retenciones.",
      "Revisa si el receptor es Nacional o Extranjero.",
      [
        { label: "RFC receptor", value: receptor.rfcReceptor ?? "—" },
        { label: "Nombre receptor", value: receptor.nombre ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // C2-RECEPTOR_NACIONAL_MISSING_RFC → exists in service

  // C3) RETENCIONES_RECEPTOR_NACIONAL_WITH_GENERIC_RFC_REVIEW
  if (receptor && isNacional && isNonEmptyString(receptor.rfcReceptor) && GENERIC_RFCS.has(receptor.rfcReceptor)) {
    addFinding(
      "RETENCIONES_RECEPTOR_NACIONAL_WITH_GENERIC_RFC_REVIEW",
      "INFO",
      "Receptor nacional con RFC genérico",
      "El RFC del receptor nacional es un RFC genérico (público en general u operaciones con extranjeros).",
      "Confirma que corresponda al tipo de operación.",
      [
        { label: "RFC receptor", value: receptor.rfcReceptor },
        { label: "Nombre receptor", value: receptor.nombre ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // C4) RETENCIONES_RECEPTOR_NACIONAL_WITHOUT_NAME
  if (receptor && isNacional && isNonEmptyString(receptor.rfcReceptor) && !isNonEmptyString(receptor.nombre)) {
    addFinding(
      "RETENCIONES_RECEPTOR_NACIONAL_WITHOUT_NAME",
      "WARNING",
      "Nombre del receptor nacional faltante",
      "El receptor nacional tiene RFC pero no tiene nombre.",
      "Revisa la información del receptor nacional.",
      [
        { label: "RFC receptor", value: receptor.rfcReceptor },
        { label: "Nacionalidad", value: receptor.nacionalidad ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // C5) RETENCIONES_RECEPTOR_NACIONAL_DOMICILIO_MISSING_REVIEW
  if (isVersion20 && receptor && isNacional && !isNonEmptyString(receptor.domicilioFiscalR)) {
    addFinding(
      "RETENCIONES_RECEPTOR_NACIONAL_DOMICILIO_MISSING_REVIEW",
      "INFO",
      "Domicilio fiscal del receptor faltante en versión 2.0",
      "Versión 2.0 de Retenciones incluye DomicilioFiscalR en el nodo Nacional del receptor.",
      "Verifica si el domicilio fiscal del receptor debe estar presente.",
      [
        { label: "RFC receptor", value: receptor.rfcReceptor ?? "—" },
        { label: "Nombre receptor", value: receptor.nombre ?? "—" },
        { label: "Versión", value: version ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // C6-RECEPTOR_EXTRANJERO_MISSING_NUM_REG_ID_TRIB → exists in service

  // ── D) Periodo ──
  // D1-MISSING_PERIODO → exists in service

  // D2) RETENCIONES_PERIODO_MES_INI_MISSING
  if (periodo && !isNonEmptyString(periodo.mesIni)) {
    addFinding(
      "RETENCIONES_PERIODO_MES_INI_MISSING",
      "WARNING",
      "Mes inicial del periodo faltante",
      "No se detectó MesIni en el periodo de Retenciones.",
      "Revisa el mes inicial del periodo.",
      [
        { label: "MesFin", value: periodo.mesFin ?? "—" },
        { label: "Ejercicio", value: periodo.ejercicio ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // D3) RETENCIONES_PERIODO_MES_FIN_MISSING
  if (periodo && !isNonEmptyString(periodo.mesFin)) {
    addFinding(
      "RETENCIONES_PERIODO_MES_FIN_MISSING",
      "WARNING",
      "Mes final del periodo faltante",
      "No se detectó MesFin en el periodo de Retenciones.",
      "Revisa el mes final del periodo.",
      [
        { label: "MesIni", value: periodo.mesIni ?? "—" },
        { label: "Ejercicio", value: periodo.ejercicio ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // D4/D5-PERIODO_INVALID → exists in service

  // ── E) Totales e impuestos retenidos ──
  // E1-MISSING_TOTALES → exists in service

  // E2) RETENCIONES_TOTAL_OPERATION_ZERO_REVIEW
  if (totales && isNonEmptyString(totales.montoTotOperacion) && toMoneyNumber(totales.montoTotOperacion) === 0) {
    addFinding(
      "RETENCIONES_TOTAL_OPERATION_ZERO_REVIEW",
      "INFO",
      "Monto total de operación es cero",
      "MontoTotOperacion en Retenciones es 0.00. Verifica si corresponde al tipo de documento.",
      "Revisa que el monto total de operación sea correcto.",
      [
        { label: "MontoTotOperacion", value: totales.montoTotOperacion },
        { label: "CveRetenc", value: cveRetenc ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // E3-TOTAL_OPERATION_INVALID → exists in service
  // E4-TOTAL_GRAV_EXENT_OPERATION_REVIEW → exists in service
  // E5-TOTAL_RET_MISMATCH → exists in service

  // E6) RETENCIONES_TOTAL_RET_EXCEEDS_OPERATION
  if (
    totales &&
    isNonEmptyString(totales.montoTotRet) &&
    isNonEmptyString(totales.montoTotOperacion)
  ) {
    const montoRet = toMoneyNumber(totales.montoTotRet);
    const montoOp = toMoneyNumber(totales.montoTotOperacion);
    if (montoRet > montoOp) {
      addFinding(
        "RETENCIONES_TOTAL_RET_EXCEEDS_OPERATION",
        "CRITICAL",
        "Monto total retenido excede el monto total de operación",
        "MontoTotRet es mayor que MontoTotOperacion en Retenciones.",
        "Revisa los montos antes de utilizar este XML.",
        [
          { label: "MontoTotRet", value: totales.montoTotRet },
          { label: "MontoTotOperacion", value: totales.montoTotOperacion },
          { label: "Diferencia", value: (montoRet - montoOp).toFixed(2) },
          { label: "UUID", value: uuid ?? "—" },
        ],
      );
    }

    // E7) RETENCIONES_TOTAL_RET_ZERO_WITH_IMPUESTOS
    if (
      montoRet === 0 &&
      totales.impuestosRetenidos.length > 0 &&
      totales.impuestosRetenidos.some((ir) => isNonEmptyString(ir.montoRet) && toMoneyNumber(ir.montoRet) > 0)
    ) {
      addFinding(
        "RETENCIONES_TOTAL_RET_ZERO_WITH_IMPUESTOS",
        "CRITICAL",
        "Monto total retenido es cero con impuestos retenidos positivos",
        "MontoTotRet es 0.00 pero existen impuestos retenidos con MontoRet mayor a 0.",
        "Revisa la consistencia de los montos antes de utilizar este XML.",
        [
          { label: "MontoTotRet", value: totales.montoTotRet },
          { label: "Total impuestos retenidos", value: String(totales.impuestosRetenidos.length) },
          { label: "Suma MontoRet", value: totales.impuestosRetenidos.reduce((acc, ir) => acc + toMoneyNumber(ir.montoRet), 0).toFixed(2) },
          { label: "UUID", value: uuid ?? "—" },
        ],
      );
    }
  }

  // F1-WITHOUT_IMP_RETENIDOS → exists in service

  // F2) RETENCIONES_IMP_RETENIDO_TIPO_PAGO_MISSING_REVIEW
  if (totales && totales.impuestosRetenidos.length > 0) {
    const missingTipoPago = totales.impuestosRetenidos.some(
      (ir) => isNonEmptyString(ir.impuesto) && !isNonEmptyString(ir.tipoPagoRet),
    );
    if (missingTipoPago) {
      addFinding(
        "RETENCIONES_IMP_RETENIDO_TIPO_PAGO_MISSING_REVIEW",
        "INFO",
        "Tipo de pago faltante en impuesto retenido",
        "Algún impuesto retenido no tiene TipoPagoRet.",
        "Verifica que todos los impuestos retenidos tengan TipoPagoRet.",
        [
          { label: "Total impuestos retenidos", value: String(totales.impuestosRetenidos.length) },
          { label: "UUID", value: uuid ?? "—" },
        ],
      );
    }
  }

  // (bonus S, T, U codes exist in service)

  // ── G) Complementos específicos ──
  const cn = complementoNames ?? [];

  // G1) RETENCIONES_COMPLEMENTO_DIVIDENDOS_MISSING
  if (cveRetenc === "01" && !cn.some((c) => c.toLowerCase().includes("dividend"))) {
    addFinding(
      "RETENCIONES_COMPLEMENTO_DIVIDENDOS_MISSING",
      "WARNING",
      "Complemento de dividendos no detectado",
      "CveRetenc es 01 (Dividendos) pero no se detectó el complemento Dividendos.",
      "Verifica que el XML incluya el complemento de dividendos correspondiente.",
      [
        { label: "CveRetenc", value: cveRetenc },
        { label: "DescRetenc", value: descRetenc ?? "—" },
        { label: "Complementos detectados", value: cn.join(", ") || "Ninguno" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // G2) RETENCIONES_COMPLEMENTO_INTERESES_INVALID
  if (cveRetenc === "02" && !cn.some((c) => c.toLowerCase().includes("interes"))) {
    addFinding(
      "RETENCIONES_COMPLEMENTO_INTERESES_INVALID",
      "INFO",
      "Complemento de intereses no detectado",
      "CveRetenc es 02 (Intereses) pero no se detectó el complemento Intereses.",
      "Verifica que el XML incluya el complemento de intereses correspondiente.",
      [
        { label: "CveRetenc", value: cveRetenc },
        { label: "DescRetenc", value: descRetenc ?? "—" },
        { label: "Complementos detectados", value: cn.join(", ") || "Ninguno" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // G3) RETENCIONES_COMPLEMENTO_PAGOS_EXTRANJEROS_MISSING
  if (cveRetenc === "03" && !cn.some((c) => c.toLowerCase().includes("extranjero"))) {
    addFinding(
      "RETENCIONES_COMPLEMENTO_PAGOS_EXTRANJEROS_MISSING",
      "WARNING",
      "Complemento de pagos al extranjero no detectado",
      "CveRetenc es 03 (Pagos al extranjero) pero no se detectó el complemento PagosExtranjeros.",
      "Verifica que el XML incluya el complemento de pagos al extranjero correspondiente.",
      [
        { label: "CveRetenc", value: cveRetenc },
        { label: "DescRetenc", value: descRetenc ?? "—" },
        { label: "Complementos detectados", value: cn.join(", ") || "Ninguno" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }

  // ── H) Complementos no reconocidos ──
  // H1 (complement detection) → exists via complementoNames in service

  // H2) RETENCIONES_COMPLEMENTO_DESCONOCIDO_REVIEW
  const unknownComps = cn.filter((c) => !KNOWN_RETENCIONES_COMPLEMENTS.has(c));
  if (unknownComps.length > 0) {
    addFinding(
      "RETENCIONES_COMPLEMENTO_DESCONOCIDO_REVIEW",
      "INFO",
      "Complemento(s) no reconocido(s) en Retenciones",
      "Se detectaron complementos no reconocidos por el motor de auditoría.",
      "Revisa si corresponden a complementos válidos del SAT.",
      [
        { label: "Complemento(s)", value: unknownComps.join(", ") },
        { label: "UUID", value: uuid ?? "—" },
      ],
    );
  }
}
