export interface StampValidationContext {
  hasTimbreFiscalDigital: boolean;
  versionTimbre: string | null;
  uuid: string | null;
  fechaTimbrado: string | null;
  fecha: string | null;
  rfcProvCertif: string | null;
  selloCfd: string | null;
  selloSat: string | null;
  sello: string | null;
  noCertificadoSat: string | null;
  certificado: string | null;
  diag: { isStamped: boolean };
  addFinding: (
    code: string,
    severity: "INFO" | "WARNING" | "CRITICAL",
    title: string,
    message: string,
    recommendedAction?: string,
    evidence?: { label: string; value?: string }[],
  ) => void;
}

function looksLikeRfc(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{2,3}[0-9A-Z]$/.test(
    v.trim().toUpperCase(),
  );
}

function isGenericRfc(v: string | null | undefined): boolean {
  if (!v) return false;
  const u = v.trim().toUpperCase();
  return u === "XAXX010101000" || u === "XEXX010101000";
}

function tryParseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d;
}

function hoursDiff(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

function isBase64(v: string): boolean {
  return /^[A-Za-z0-9+/]*={0,2}$/.test(v.trim());
}

export function validateStamp(ctx: StampValidationContext): void {
  const {
    hasTimbreFiscalDigital,
    versionTimbre,
    uuid,
    fechaTimbrado,
    fecha,
    rfcProvCertif,
    selloCfd,
    selloSat,
    sello,
    noCertificadoSat,
    certificado,
    diag,
    addFinding,
  } = ctx;

  if (!hasTimbreFiscalDigital) return;

  function ev(label: string, value?: string | null): { label: string; value?: string } {
    return { label, value: value ?? "—" };
  }

  // A3) TFD_UUID_MISSING
  if (!uuid) {
    addFinding(
      "TFD_UUID_MISSING",
      "WARNING",
      "UUID ausente en TimbreFiscalDigital",
      "El TimbreFiscalDigital existe pero no contiene UUID. Esto impide la identificación única del comprobante ante el SAT.",
      "Solicita el XML original timbrado al PAC o emisor.",
      [
        ev("UUID", uuid),
        ev("Fecha timbrado", fechaTimbrado),
        ev("Complemento detectado", "TimbreFiscalDigital"),
      ],
    );
  }

  // A2) TFD_VERSION_REVIEW
  if (versionTimbre && !["1.0", "1.1"].includes(versionTimbre.trim())) {
    addFinding(
      "TFD_VERSION_REVIEW",
      "WARNING",
      "Versión del TimbreFiscalDigital no estándar",
      `La versión del TimbreFiscalDigital es "${versionTimbre}", no coincide con "1.0" o "1.1". Puede indicar un complemento no estándar.`,
      "Revisa que el XML haya sido timbrado por un PAC autorizado.",
      [ev("Version", versionTimbre), ev("UUID", uuid)],
    );
  }

  // A5) TFD_UUID_LOWERCASE_REVIEW
  if (uuid && uuid === uuid.toLowerCase()) {
    addFinding(
      "TFD_UUID_LOWERCASE_REVIEW",
      "INFO",
      "UUID en minúsculas en TimbreFiscalDigital",
      "El UUID del timbre está en minúsculas. El SAT espera UUID en mayúsculas en la representación impresa, aunque el XML puede ser válido.",
      "Verifica que el UUID sea correcto comparándolo con el original del PAC.",
      [ev("UUID", uuid)],
    );
  }

  // B2) TFD_FECHA_TIMBRADO_INVALID
  if (fechaTimbrado && !tryParseDate(fechaTimbrado)) {
    addFinding(
      "TFD_FECHA_TIMBRADO_INVALID",
      "WARNING",
      "Fecha de timbrado inválida",
      `La fecha de timbrado "${fechaTimbrado}" no tiene un formato válido.`,
      "Revisa el atributo FechaTimbrado del TimbreFiscalDigital en el XML original.",
      [ev("Fecha timbrado", fechaTimbrado), ev("UUID", uuid)],
    );
  }

  const timbradoDate = tryParseDate(fechaTimbrado);
  const cfdiDate = tryParseDate(fecha);

  // B5) TFD_FECHA_TIMBRADO_FUTURE_REVIEW
  if (timbradoDate) {
    const now = new Date();
    if (timbradoDate.getTime() > now.getTime() + 3600000) {
      addFinding(
        "TFD_FECHA_TIMBRADO_FUTURE_REVIEW",
        "INFO",
        "Fecha de timbrado futura",
        "La fecha de timbrado es futura por más de una hora. Puede indicar un error de reloj o un XML manipulado.",
        "Verifica la fecha del XML contra la hora oficial del SAT.",
        [ev("Fecha timbrado", fechaTimbrado), ev("UUID", uuid)],
      );
    }
  }

  // B4) TFD_FECHA_TIMBRADO_TOO_FAR_AFTER_FECHA_CFDI_REVIEW
  if (timbradoDate && cfdiDate) {
    const diff = hoursDiff(timbradoDate, cfdiDate);
    if (diff > 72) {
      addFinding(
        "TFD_FECHA_TIMBRADO_TOO_FAR_AFTER_FECHA_CFDI_REVIEW",
        "INFO",
        "Fecha de timbrado muy posterior a la fecha del CFDI",
        `La fecha de timbrado difiere de la fecha del CFDI por más de 72 horas (${Math.abs(diff).toFixed(0)}h). Esto puede indicar despacho tardío o inconsistencia.`,
        "Confirma que el XML haya sido timbrado dentro del plazo esperado.",
        [
          ev("Fecha CFDI", fecha),
          ev("Fecha timbrado", fechaTimbrado),
          ev("Diferencia horas", `${Math.abs(diff).toFixed(0)}h`),
          ev("UUID", uuid),
        ],
      );
    }
  }

  // C2) TFD_RFC_PROV_CERTIF_FORMAT_REVIEW
  if (rfcProvCertif && !looksLikeRfc(rfcProvCertif)) {
    addFinding(
      "TFD_RFC_PROV_CERTIF_FORMAT_REVIEW",
      "WARNING",
      "Formato de RFC del proveedor de certificación no estándar",
      `El RfcProvCertif "${rfcProvCertif}" no tiene el formato estándar de RFC mexicano.`,
      "Verifica el RfcProvCertif del TimbreFiscalDigital en el XML original.",
      [ev("RfcProvCertif", rfcProvCertif), ev("UUID", uuid)],
    );
  }

  // C3) TFD_RFC_PROV_CERTIF_GENERIC_REVIEW
  if (rfcProvCertif && isGenericRfc(rfcProvCertif)) {
    addFinding(
      "TFD_RFC_PROV_CERTIF_GENERIC_REVIEW",
      "WARNING",
      "RFC genérico como proveedor de certificación",
      `El RFC del PAC es un RFC genérico (${rfcProvCertif}). Esto es inusual y puede indicar un timbre de prueba o simulación.`,
      "Verifica que el PAC sea un proveedor autorizado y el XML haya sido timbrado correctamente.",
      [ev("RfcProvCertif", rfcProvCertif), ev("UUID", uuid)],
    );
  }

  // D3) TFD_SELLO_CFD_DIFFERS_FROM_COMPROBANTE_SELLO_REVIEW
  if (selloCfd && sello && selloCfd.trim() !== sello.trim()) {
    addFinding(
      "TFD_SELLO_CFD_DIFFERS_FROM_COMPROBANTE_SELLO_REVIEW",
      "WARNING",
      "SelloCFD del timbre difiere del Sello del comprobante",
      "El SelloCFD dentro del TimbreFiscalDigital no coincide con el Sello del comprobante. Esto es una anomalía grave que invalida el CFDI.",
      "Solicita el XML original del PAC y verifica que no haya sido manipulado.",
      [
        ev("UUID", uuid),
        ev("SelloCFD presente", selloCfd ? "Sí" : "No"),
        ev("Sello comprobante presente", sello ? "Sí" : "No"),
      ],
    );
  }

  // D4) TFD_SELLO_CFD_TOO_SHORT_REVIEW
  if (selloCfd && selloCfd.trim().length < 100) {
    addFinding(
      "TFD_SELLO_CFD_TOO_SHORT_REVIEW",
      "INFO",
      "SelloCFD del timbre inusualmente corto",
      `El SelloCFD tiene solo ${selloCfd.trim().length} caracteres. Un sello base64 típico supera los 100 caracteres.`,
      "Revisa la integridad del TimbreFiscalDigital.",
      [ev("Longitud sello CFD", String(selloCfd.trim().length)), ev("UUID", uuid)],
    );
  }

  // D5) TFD_SELLO_SAT_TOO_SHORT_REVIEW
  if (selloSat && selloSat.trim().length < 100) {
    addFinding(
      "TFD_SELLO_SAT_TOO_SHORT_REVIEW",
      "INFO",
      "SelloSAT del timbre inusualmente corto",
      `El SelloSAT tiene solo ${selloSat.trim().length} caracteres. Un sello base64 típico supera los 100 caracteres.`,
      "Revisa la integridad del TimbreFiscalDigital.",
      [ev("Longitud sello SAT", String(selloSat.trim().length)), ev("UUID", uuid)],
    );
  }

  // D6) TFD_SELLO_CFD_BASE64_REVIEW
  if (selloCfd && !isBase64(selloCfd)) {
    addFinding(
      "TFD_SELLO_CFD_BASE64_REVIEW",
      "INFO",
      "SelloCFD del timbre no es base64 estándar",
      "El SelloCFD contiene caracteres no válidos para base64. Puede ser un placeholder o un formato atípico.",
      "Revisa el TimbreFiscalDigital del XML original.",
      [ev("UUID", uuid)],
    );
  }

  // D7) TFD_SELLO_SAT_BASE64_REVIEW
  if (selloSat && !isBase64(selloSat)) {
    addFinding(
      "TFD_SELLO_SAT_BASE64_REVIEW",
      "INFO",
      "SelloSAT del timbre no es base64 estándar",
      "El SelloSAT contiene caracteres no válidos para base64. Puede ser un placeholder o un formato atípico.",
      "Revisa el TimbreFiscalDigital del XML original.",
      [ev("UUID", uuid)],
    );
  }

  // E7) COMPROBANTE_CERTIFICADO_TOO_SHORT_REVIEW
  if (certificado && certificado.trim().length < 100) {
    addFinding(
      "COMPROBANTE_CERTIFICADO_TOO_SHORT_REVIEW",
      "INFO",
      "Certificado del CFDI inusualmente corto",
      `El certificado del comprobante tiene solo ${certificado.trim().length} caracteres. Un certificado base64 típico es mucho más largo.`,
      "Verifica que el XML contenga el certificado original completo.",
      [ev("Longitud certificado", String(certificado.trim().length)), ev("UUID", uuid)],
    );
  }

  // E8) COMPROBANTE_CERTIFICADO_BASE64_REVIEW
  if (certificado && !isBase64(certificado)) {
    addFinding(
      "COMPROBANTE_CERTIFICADO_BASE64_REVIEW",
      "INFO",
      "Certificado del CFDI no es base64 estándar",
      "El atributo Certificado del comprobante contiene caracteres no válidos para base64. Puede ser un placeholder o estar mal formado.",
      "Revisa el XML original emitido por el PAC.",
      [ev("UUID", uuid)],
    );
  }

  // F2) TFD_PRESENT_BUT_ISSTAMPED_FALSE_REVIEW
  if (hasTimbreFiscalDigital && !diag.isStamped) {
    addFinding(
      "TFD_PRESENT_BUT_ISSTAMPED_FALSE_REVIEW",
      "WARNING",
      "TimbreFiscalDigital presente pero CFDI no marcado como timbrado",
      "Se detectó un nodo TimbreFiscalDigital pero el CFDI no se considera timbrado (sin UUID válido). Puede ser un timbre incompleto o mal formado.",
      "Verifica el XML original y descarga una nueva copia timbrada del PAC.",
      [ev("UUID", uuid), ev("Fecha timbrado", fechaTimbrado)],
    );
  }
}
