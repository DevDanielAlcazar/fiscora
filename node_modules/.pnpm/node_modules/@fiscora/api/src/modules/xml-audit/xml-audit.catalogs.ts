export const CFDI_TIPO_COMPROBANTE: Record<string, string> = {
  I: "Ingreso",
  E: "Egreso",
  T: "Traslado",
  N: "Nómina",
  P: "Pago",
};

export const CFDI_MONEDAS_BASICAS: Record<string, string> = {
  MXN: "Peso Mexicano",
  USD: "Dólar estadounidense",
  EUR: "Euro",
  XXX: "Los códigos asignados para las transacciones en que intervenga ninguna moneda",
};

export const CFDI_EXPORTACION_BASIC: Record<string, string> = {
  "01": "No aplica",
  "02": "Definitiva",
  "03": "Temporal",
  "04": "Definitiva - Clave distinta",
};

export const CFDI_METODO_PAGO_BASIC: Record<string, string> = {
  PUE: "Pago en una sola exhibición",
  PPD: "Pago en parcialidades o diferido",
};

export const CFDI_FORMA_PAGO_BASIC: Record<string, string> = {
  "01": "Efectivo",
  "02": "Cheque nominativo",
  "03": "Transferencia electrónica de fondos",
  "04": "Tarjeta de crédito",
  "05": "Monedero electrónico",
  "06": "Dinero electrónico",
  "08": "Vales de despensa",
  "12": "Dación en pago",
  "13": "Pago por subrogación",
  "14": "Pago por consignación",
  "15": "Condonación",
  "17": "Compensación",
  "23": "Novación",
  "24": "Confusión",
  "25": "Remisión de deuda",
  "26": "Prescripción o caducidad",
  "27": "A satisfacción del acreedor",
  "28": "Tarjeta de débito",
  "29": "Tarjeta de servicios",
  "30": "Aplicación de anticipos",
  "31": "Intermediario pagos",
  "99": "Por definir",
};

export const CFDI_OBJETO_IMP_BASIC: Record<string, string> = {
  "01": "No objeto de impuesto",
  "02": "Sí objeto de impuesto",
  "03": "Sí objeto de impuesto y no obligado al desglose",
  "04": "Sí objeto de impuesto y no causa impuesto",
};

export const CFDI_IMPUESTO_BASIC: Record<string, string> = {
  "001": "ISR",
  "002": "IVA",
  "003": "IEPS",
};

export const CFDI_TIPO_FACTOR_BASIC: Record<string, string> = {
  Tasa: "Tasa",
  Cuota: "Cuota",
  Exento: "Exento",
};

export const CFDI_TIPO_RELACION_BASIC: Record<string, string> = {
  "01": "Nota de crédito de los documentos relacionados",
  "02": "Nota de débito de los documentos relacionados",
  "03": "Devolución de mercancía sobre facturas o traslados previos",
  "04": "Sustitución de los CFDI previos",
  "05": "Traslados de mercancías facturados previamente",
  "06": "Factura generada por los traslados previos",
  "07": "CFDI por aplicación de anticipo",
};

function normalizeCatalogCode(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toUpperCase();
}

function normalizeCatalogCodeExact(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

export function getCatalogLabel(
  catalog: Record<string, string>,
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (catalog[trimmed]) return catalog[trimmed];
  const upper = trimmed.toUpperCase();
  if (upper !== trimmed && catalog[upper]) return catalog[upper];
  return null;
}

export function isKnownCatalogCode(
  catalog: Record<string, string>,
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  const trimmed = code.trim();
  if (catalog[trimmed] !== undefined) return true;
  const upper = trimmed.toUpperCase();
  if (upper !== trimmed && catalog[upper] !== undefined) return true;
  return false;
}

function getLabelByExactKey(
  catalog: Record<string, string>,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return catalog[value.trim()] ?? null;
}

export function getTipoComprobanteLabel(value: string | null | undefined): string | null {
  return getCatalogLabel(CFDI_TIPO_COMPROBANTE, value);
}

export function getMetodoPagoLabel(value: string | null | undefined): string | null {
  return getCatalogLabel(CFDI_METODO_PAGO_BASIC, value);
}

export function getFormaPagoLabel(value: string | null | undefined): string | null {
  return getLabelByExactKey(CFDI_FORMA_PAGO_BASIC, value);
}

export function getObjetoImpLabel(value: string | null | undefined): string | null {
  return getLabelByExactKey(CFDI_OBJETO_IMP_BASIC, value);
}

export function getImpuestoLabel(value: string | null | undefined): string | null {
  return getLabelByExactKey(CFDI_IMPUESTO_BASIC, value);
}

export function getTipoFactorLabel(value: string | null | undefined): string | null {
  return getCatalogLabel(CFDI_TIPO_FACTOR_BASIC, value);
}

export function getTipoRelacionLabel(value: string | null | undefined): string | null {
  return getLabelByExactKey(CFDI_TIPO_RELACION_BASIC, value);
}

export function getExportacionLabel(value: string | null | undefined): string | null {
  return getLabelByExactKey(CFDI_EXPORTACION_BASIC, value);
}

export function getCurrencyLabel(value: string | null | undefined): string | null {
  return getCatalogLabel(CFDI_MONEDAS_BASICAS, value);
}

export function isKnownTipoComprobante(value: string | null | undefined): boolean {
  return isKnownCatalogCode(CFDI_TIPO_COMPROBANTE, value);
}

export function isKnownMetodoPago(value: string | null | undefined): boolean {
  return isKnownCatalogCode(CFDI_METODO_PAGO_BASIC, value);
}

export function isKnownFormaPago(value: string | null | undefined): boolean {
  return getLabelByExactKey(CFDI_FORMA_PAGO_BASIC, value) !== null;
}

export function isKnownObjetoImp(value: string | null | undefined): boolean {
  return getLabelByExactKey(CFDI_OBJETO_IMP_BASIC, value) !== null;
}

export function isKnownImpuesto(value: string | null | undefined): boolean {
  return getLabelByExactKey(CFDI_IMPUESTO_BASIC, value) !== null;
}

export function isKnownTipoFactor(value: string | null | undefined): boolean {
  return isKnownCatalogCode(CFDI_TIPO_FACTOR_BASIC, value);
}

export function isKnownTipoRelacion(value: string | null | undefined): boolean {
  return getLabelByExactKey(CFDI_TIPO_RELACION_BASIC, value) !== null;
}

export function isKnownExportacion(value: string | null | undefined): boolean {
  return getLabelByExactKey(CFDI_EXPORTACION_BASIC, value) !== null;
}

export function isKnownCurrencyBasic(value: string | null | undefined): boolean {
  return isKnownCatalogCode(CFDI_MONEDAS_BASICAS, value);
}

export const CFDI_USO_CFDI_BASIC: Record<string, string> = {
  G01: "Adquisición de mercancías",
  G02: "Devoluciones, descuentos o bonificaciones",
  G03: "Gastos en general",
  I01: "Construcciones",
  I02: "Mobiliario y equipo de oficina por inversiones",
  I03: "Equipo de transporte",
  I04: "Equipo de cómputo y accesorios",
  I05: "Dados, troqueles, moldes, matrices y herramental",
  I06: "Comunicaciones telefónicas",
  I07: "Comunicaciones satelitales",
  I08: "Otra maquinaria y equipo",
  D01: "Honorarios médicos, dentales y gastos hospitalarios",
  D02: "Gastos médicos por incapacidad o discapacidad",
  D03: "Gastos funerales",
  D04: "Donativos",
  D05: "Intereses reales efectivamente pagados por créditos hipotecarios",
  D06: "Aportaciones voluntarias al SAR",
  D07: "Primas por seguros de gastos médicos",
  D08: "Gastos de transportación escolar obligatoria",
  D09: "Depósitos en cuentas para el ahorro, primas con base en planes de pensiones",
  D10: "Pagos por servicios educativos (colegiaturas)",
  S01: "Sin efectos fiscales",
  CP01: "Pagos",
  CN01: "Nómina",
};

export function getUsoCfdiLabel(value: string | null | undefined): string | null {
  return getLabelByExactKey(CFDI_USO_CFDI_BASIC, value);
}

export function isKnownUsoCfdi(value: string | null | undefined): boolean {
  return getLabelByExactKey(CFDI_USO_CFDI_BASIC, value) !== null;
}

export const CFDI_REGIMEN_FISCAL_BASIC: Record<string, string> = {
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
  "606": "Arrendamiento",
  "607": "Régimen de Enajenación o Adquisición de Bienes",
  "608": "Demás ingresos",
  "610": "Residentes en el Extranjero sin Establecimiento Permanente en México",
  "611": "Ingresos por Dividendos",
  "612": "Personas Físicas con Actividades Empresariales y Profesionales",
  "614": "Ingresos por intereses",
  "615": "Régimen de los ingresos por obtención de premios",
  "616": "Sin obligaciones fiscales",
  "620": "Sociedades Cooperativas de Producción que optan por diferir sus ingresos",
  "621": "Incorporación Fiscal",
  "622": "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
  "623": "Opcional para Grupos de Sociedades",
  "624": "Coordinados",
  "625": "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
  "626": "Régimen Simplificado de Confianza",
};

export function getRegimenFiscalLabel(value: string | null | undefined): string | null {
  return getLabelByExactKey(CFDI_REGIMEN_FISCAL_BASIC, value);
}

export function isKnownRegimenFiscal(value: string | null | undefined): boolean {
  return getLabelByExactKey(CFDI_REGIMEN_FISCAL_BASIC, value) !== null;
}
