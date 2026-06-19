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
  "05": "Sí objeto de impuesto y sí obligado al desglose",
  "06": "Sí objeto de impuesto y no causa impuesto por tratarse de pagos parciales",
  "07": "Sí objeto de impuesto y sí obligado al desglose por tratarse de pagos parciales",
  "08": "Sí objeto de impuesto y sí obligado al desglose por tratarse de una operación con varios objetos de impuesto",
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

export const RETENCIONES_NACIONALIDAD_BASIC: Record<string, string> = {
  Nacional: "Nacional",
  Extranjero: "Extranjero",
};

export const RETENCIONES_CVE_RETENC_BASIC: Record<string, string> = {
  "01": "Dividendos o utilidades",
  "02": "Intereses",
  "03": "Pagos al extranjero",
  "04": "Enajenación de acciones",
  "05": "Arrendamiento",
  "06": "Honorarios",
  "07": "Demás ingresos",
  "08": "Ingresos por la enajenación de bienes",
  "09": "Ingresos por la prestación de servicios",
  "10": "Ingresos por otorgamiento del uso o goce temporal de bienes",
  "11": "Adquisición de bienes",
  "12": "Adquisición de mercancías",
  "13": "Adquisición de bienes y servicios para la producción",
  "14": "Adquisición de servicios",
  "15": "Adquisición de arrendamiento",
  "16": "Adquisición de bienes de activo fijo",
  "17": "Adquisición de bienes de activo fijo",
  "18": "Adquisición de bienes de activo fijo",
  "19": "Pagos por la adquisición de bienes de activo fijo",
  "20": "Pagos por la adquisición de bienes de activo fijo",
  "21": "Pagos por la adquisición de bienes de activo fijo",
  "22": "Pagos por la adquisición de bienes de activo fijo",
  "23": "Pagos por la adquisición de bienes de activo fijo",
  "24": "Pagos por la adquisición de bienes de activo fijo",
  "25": "Pagos por la adquisición de bienes de activo fijo",
  "26": "Pagos por la adquisición de bienes de activo fijo",
};

export const RETENCIONES_IMPUESTO_RET_BASIC: Record<string, string> = {
  "01": "ISR",
  "02": "IVA",
  "03": "IEPS",
};

export const RETENCIONES_TIPO_PAGO_RET_BASIC: Record<string, string> = {
  "Pago definitivo": "Pago definitivo",
  "Pago provisional": "Pago provisional",
};

export const NOMINA_TIPO_NOMINA_BASIC: Record<string, string> = {
  O: "Ordinaria",
  E: "Extraordinaria",
};

export const NOMINA_TIPO_REGIMEN_BASIC: Record<string, string> = {
  "02": "Sueldos",
  "03": "Jubilados",
  "04": "Pensionados",
  "05": "Asimilados",
  "06": "Independientes",
  "07": "Comisionistas",
  "08": "Actividades Empresariales",
  "09": "Actividades Agrícolas",
  "10": "Plataformas Digitales",
  "11": "RESICO",
  "12": "Incorporación Fiscal",
  "99": "Otros",
};

export const CARTA_PORTE_TRANSP_INTERNAC_BASIC: Record<string, string> = {
  Sí: "Sí",
  Si: "Sí",
  SI: "Sí",
  No: "No",
  "0": "No",
  "1": "Sí",
};

export function isKnownRetencionesNacionalidad(value: string | null | undefined): boolean {
  return getLabelByExactKey(RETENCIONES_NACIONALIDAD_BASIC, value) !== null;
}

export function isKnownCveRetenc(value: string | null | undefined): boolean {
  return getLabelByExactKey(RETENCIONES_CVE_RETENC_BASIC, value) !== null;
}

export function isKnownImpuestoRet(value: string | null | undefined): boolean {
  return getLabelByExactKey(RETENCIONES_IMPUESTO_RET_BASIC, value) !== null;
}

export function isKnownRetencionesTipoPago(value: string | null | undefined): boolean {
  return getLabelByExactKey(RETENCIONES_TIPO_PAGO_RET_BASIC, value) !== null;
}

export function isKnownNominaTipoNomina(value: string | null | undefined): boolean {
  return getLabelByExactKey(NOMINA_TIPO_NOMINA_BASIC, value) !== null;
}

export function isKnownNominaTipoRegimen(value: string | null | undefined): boolean {
  return getLabelByExactKey(NOMINA_TIPO_REGIMEN_BASIC, value) !== null;
}

export function isKnownCartaPorteTranspInternac(value: string | null | undefined): boolean {
  return getLabelByExactKey(CARTA_PORTE_TRANSP_INTERNAC_BASIC, value) !== null;
}
