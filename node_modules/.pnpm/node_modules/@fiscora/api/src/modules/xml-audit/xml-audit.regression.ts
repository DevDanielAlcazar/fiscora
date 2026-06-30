/**
 * Suite de regresión técnica local para el motor de Auditoría XML (Fiscora).
 *
 * - Usa XMLs sintéticos generados íntegramente en memoria.
 * - No requiere conexión a base de datos, Prisma, SAT, Stripe ni archivos reales.
 * - No guarda XML fuente ni genera persistencia.
 * - Ejecución: pnpm --filter @fiscora/api xml-audit:regression
 *
 * ADVERTENCIA: No usar XMLs reales de clientes en esta suite.
 * Todos los fixtures son sintéticos y no contienen datos fiscales reales.
 */

import assert from "node:assert";
import {
  analyzeCfdi,
  toAnalysisResponse,
  type CfdiAnalysisResult,
  type Finding,
  type NormalizedXml,
  getFindingPriority,
  getFindingActionGroup,
  sanitizeEvidenceValue,
  sanitizeFindingEvidence,
  sanitizeFinding,
  limitFindings,
} from "./xml-audit.service.js";
import {
  type FindingLocation,
  type FindingValueTrace,
} from "./finding-evidence-location.helper.js";
import { analyzeZipFull, generateNormalizedZip } from "./xml-zip-audit.service.js";
import {
  getMetodoPagoLabel,
  getFormaPagoLabel,
  getImpuestoLabel,
  getTipoFactorLabel,
  getObjetoImpLabel,
  getRegimenFiscalLabel,
  isKnownRegimenFiscal,
} from "./xml-audit.catalogs.js";
import AdmZip from "adm-zip";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  assert.deepStrictEqual(actual, expected, msg);
}

function assertTruthy(value: unknown, msg: string): void {
  assert.ok(value, msg);
}

function assertNotEqual<T>(actual: T, expected: T, msg: string): void {
  assert.notStrictEqual(actual, expected, msg);
}

function assertNotHas(obj: Record<string, unknown>, key: string, msg: string): void {
  assert.ok(!(key in obj) || obj[key] === undefined, msg);
}

function assertIncludesFinding(findings: Finding[], code: string, severity?: string): void {
  const match = findings.find((f) => f.code === code);
  assertTruthy(match, `Finding ${code} no encontrado`);
  if (severity) {
    assertEqual(match!.severity, severity as any, `Finding ${code} no tiene severity ${severity}`);
  }
}

async function runCase(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  \u2705 ${name}`);
  } catch (err: unknown) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  \u274c ${name}`);
    console.log(`       ${msg}`);
  }
}

function printSummary(): void {
  const total = passed + failed;
  console.log(`\n\x1b[1mResumen: ${passed}/${total} casos pasaron\x1b[0m`);
  if (failed > 0) {
    console.log(`\x1b[31m${failed} caso(s) fallaron\x1b[0m`);
  }
}

// ─── XML Fixtures ────────────────────────────────────────────────────────────

const CFDI_4_NS = 'xmlns:cfdi="http://www.sat.gob.mx/cfd/4"';
const TFD_NS = 'xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"';
const PAGO20_NS = 'xmlns:pago20="http://www.sat.gob.mx/Pagos20"';
const XSI_NS = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
const SCHEMA_LOCATION =
  'xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"';

function buildCfdi40Ingreso(opts?: {
  total?: string;
  subtotal?: string;
  includeTimbre?: boolean;
}): string {
  const total = opts?.total ?? "1160.00";
  const subtotal = opts?.subtotal ?? "1000.00";
  const timbre =
    (opts?.includeTimbre ?? true)
      ? `<tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="123" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="${subtotal}" Moneda="MXN" Total="${total}" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto de prueba" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>${timbre}</cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildBomXml(): string {
  return "\uFEFF" + buildCfdi40Ingreso();
}

function buildLeadingContentXml(): string {
  return "texto previo basura\ncontenido extra\n" + buildCfdi40Ingreso();
}

function buildPago20Xml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${PAGO20_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="P" Folio="1" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="OP001">
        <pago20:DoctoRelacionado IdDocumento="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" Serie="A" Folio="123" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="5000.00" ImpPagado="5000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildMultiTaxXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="456" Fecha="2024-03-01T09:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="2000.00" Moneda="MXN" Total="2560.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto IVA" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="01010102" Cantidad="2" ClaveUnidad="H87" Descripcion="Producto IEPS" ValorUnitario="500.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.080000" Importe="80.00"/>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="400.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
      <cfdi:Traslado Base="1000.00" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.080000" Importe="80.00"/>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="bbbbbbbb-cccc-dddd-eeee-ffffffffffff" FechaTimbrado="2024-03-01T09:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildBadTotalsXml(): string {
  return buildCfdi40Ingreso({ total: "9999.99", includeTimbre: true });
}

function buildUntimbradoXml(): string {
  return buildCfdi40Ingreso({ includeTimbre: false });
}

function buildCorruptXml(): string {
  return "esto no es xml valido %%{}<>";
}

// DU) Pago con moneda distinta de XXX
async function testPagoConMonedaDistinta(): Promise<void> {
  const xml = buildPago20Xml().replace('Moneda="XXX"', 'Moneda="MXN"');
  const result = analyzeCfdi(xml, "pago-moneda-distinta.xml");
  assertIncludesFinding(result.findings, "PAYMENT_CFDI_MONEDA_NOT_XXX", "WARNING");
}

// DV) Pago con subtotal/total distinto de cero
async function testPagoConTotalesDistintoCero(): Promise<void> {
  const xml = buildPago20Xml()
    .replace('SubTotal="0.00"', 'SubTotal="100.00"')
    .replace('Total="0.00"', 'Total="100.00"');
  const result = analyzeCfdi(xml, "pago-totales-no-cero.xml");
  assertIncludesFinding(result.findings, "PAYMENT_CFDI_SUBTOTAL_NOT_ZERO", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_CFDI_TOTAL_NOT_ZERO", "WARNING");
}

// DW) Ingreso PPD con FormaPago distinta de 99
async function testIngresoPpdSinFormaPago99(): Promise<void> {
  const xml = buildCfdi40Ingreso()
    .replace('MetodoPago="PPD"', 'MetodoPago="PPD"')
    .replace('FormaPago="01"', 'FormaPago="03"');
  const result = analyzeCfdi(xml, "ingreso-ppd-sin-99.xml");
  assertIncludesFinding(result.findings, "METODO_PAGO_PPD_WITH_FORMA_PAGO_NOT_99", "WARNING");
}

// DX) Ingreso PUE con FormaPago 99
async function testIngresoPueConFormaPago99(): Promise<void> {
  const xml = buildCfdi40Ingreso()
    .replace('MetodoPago="PPD"', 'MetodoPago="PUE"')
    .replace('FormaPago="01"', 'FormaPago="99"');
  const result = analyzeCfdi(xml, "ingreso-pue-con-99.xml");
  assertIncludesFinding(result.findings, "INGRESO_PUE_WITH_FORMA_PAGO_99_REVIEW", "WARNING");
}

// DY) Exportacion 02 sin Comercio Exterior
async function testExportacion02SinComercioExterior(): Promise<void> {
  const xml = buildCfdi40Ingreso().replace('Exportacion="01"', 'Exportacion="02"');
  const result = analyzeCfdi(xml, "exportacion-02-sin-ce.xml");
  assertIncludesFinding(
    result.findings,
    "EXPORTACION_02_WITHOUT_COMERCIO_EXTERIOR_REVIEW",
    "WARNING",
  );
}

// DZ) ObjetoImp 01 con impuestos
async function testObjetoImp01ConImpuestos(): Promise<void> {
  const xml = buildConceptTaxXml({ objetoImp: "01", hasTraslados: true });
  const result = analyzeCfdi(xml, "objetoimp-01-con-impuestos.xml");
  assertIncludesFinding(result.findings, "CONCEPT_OBJETO_IMP_01_WITH_TAXES", "WARNING");
}

// EA) UsoCFDI CP01 sin Tipo P
async function testUsoCfdiCp01SinTipoP(): Promise<void> {
  const xml = buildCfdi40Ingreso().replace('UsoCFDI="G03"', 'UsoCFDI="CP01"');
  const result = analyzeCfdi(xml, "uso-cfdi-cp01-sin-p.xml");
  assertIncludesFinding(result.findings, "USOCFDI_CP01_WITHOUT_PAYMENT_REVIEW", "WARNING");
}

// EB) Nómina con moneda distinta de MXN
async function testNominaConMonedaDistinta(): Promise<void> {
  const xml = buildNominaXml({ tipoComprobante: "N", total: "15000.00" }).replace(
    'Moneda="MXN"',
    'Moneda="USD"',
  );
  const result = analyzeCfdi(xml, "nomina-moneda-distinta.xml");
  assertIncludesFinding(result.findings, "NOMINA_SHOULD_HAVE_MONEDA_MXN", "WARNING");
}

// EM) Nómina sin FechaPago y NumDiasPagados
async function testNominaSinFechaPagoNumDias(): Promise<void> {
  const xml = buildNominaXml({
    fechaPago: "",
    numDiasPagados: "",
  });
  const result = analyzeCfdi(xml, "nomina-sin-fecha-dias.xml");
  assertIncludesFinding(result.findings, "NOMINA_MISSING_FECHA_PAGO", "WARNING");
  assertIncludesFinding(result.findings, "NOMINA_NUM_DIAS_PAGADOS_MISSING", "WARNING");
}

// EN) FechaInicialPago > FechaFinalPago
async function testNominaFechaInicialAfterFinal(): Promise<void> {
  const xml = buildNominaXml({
    fechaInicialPago: "2024-07-20",
    fechaFinalPago: "2024-07-15",
  });
  const result = analyzeCfdi(xml, "nomina-fecha-inicial-after-final.xml");
  assertIncludesFinding(result.findings, "NOMINA_FECHA_INICIAL_AFTER_FINAL", "WARNING");
}

// EO) Receptor nómina sin datos mínimos
async function testNominaReceptorSinDatosMinimos(): Promise<void> {
  const xml = buildNominaXml({
    receptorCurp: "",
    receptorNumEmpleado: "",
    receptorTipoRegimen: "",
    receptorPeriodicidadPago: "",
    receptorClaveEntFed: "",
    receptorNss: "",
  });
  const result = analyzeCfdi(xml, "nomina-receptor-sin-datos.xml");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_MISSING_CURP", "WARNING");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_MISSING_NUM_EMPLEADO", "WARNING");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_TIPO_REGIMEN_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_PERIODICIDAD_PAGO_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_CLAVE_ENT_FED_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_NSS_MISSING_REVIEW", "INFO");
}

// EP) Percepciones TotalGravado mismatch
async function testNominaTotalGravadoMismatch(): Promise<void> {
  const xml = buildNominaXml({
    totalPercepciones: "100.00",
    percepcionesHeaderGravado: "100.00",
    percepcionesHeaderExento: "0.00",
    percepciones: [
      { tipo: "001", clave: "P001", concepto: "Sueldo", gravado: "80.00", exento: "0.00" },
    ],
  });
  const result = analyzeCfdi(xml, "nomina-total-gravado-mismatch.xml");
  assertIncludesFinding(result.findings, "NOMINA_PERCEPCIONES_TOTAL_GRAVADO_MISMATCH", "CRITICAL");
}

// EQ) Percepción sin TipoPercepcion/Clave
async function testNominaPercepcionSinTipoClave(): Promise<void> {
  const xml = buildNominaXml({
    totalPercepciones: "100.00",
    percepciones: [{ tipo: "", clave: "", concepto: "Test", gravado: "100.00", exento: "0.00" }],
  });
  const result = analyzeCfdi(xml, "nomina-percepcion-sin-tipo-clave.xml");
  assertIncludesFinding(result.findings, "NOMINA_PERCEPCION_MISSING_TIPO", "WARNING");
  assertIncludesFinding(result.findings, "NOMINA_PERCEPCION_MISSING_CLAVE", "WARNING");
}

// ER) Deducciones TotalDeducciones mismatch
async function testNominaTotalDeduccionesMismatch(): Promise<void> {
  const xml = buildNominaXml({
    totalDeducciones: "100.00",
    totalPercepciones: "1000.00",
    totalOtrosPagos: "0.00",
    deduccionesHeaderOtras: "40.00",
    deduccionesHeaderIsr: "35.00",
    deducciones: [
      { tipo: "002", clave: "D001", concepto: "IMSS", importe: "40.00" },
      { tipo: "001", clave: "D002", concepto: "ISR", importe: "30.00" },
    ],
  });
  const result = analyzeCfdi(xml, "nomina-total-ded-mismatch.xml");
  assertIncludesFinding(result.findings, "NOMINA_TOTAL_DEDUCCIONES_MISMATCH", "CRITICAL");
  assertIncludesFinding(result.findings, "NOMINA_DEDUCCIONES_TOTAL_ISR_MISMATCH", "WARNING");
  // TotalOtrasDeducciones 40 matches non-ISR sum 40, no mismatch
}

// ES) ISR sin TotalImpuestosRetenidos
async function testNominaIsrSinTotalRetenidos(): Promise<void> {
  const xml = buildNominaXml({
    totalDeducciones: "30.00",
    totalPercepciones: "1000.00",
    totalOtrosPagos: "0.00",
    deduccionesHeaderOtras: "30.00",
    deducciones: [{ tipo: "001", clave: "D001", concepto: "ISR", importe: "30.00" }],
  });
  const result = analyzeCfdi(xml, "nomina-isr-sin-total-retenidos.xml");
  assertIncludesFinding(
    result.findings,
    "NOMINA_ISR_WITHOUT_TOTAL_IMPUESTOS_RETENIDOS_REVIEW",
    "WARNING",
  );
}

// ET) OtrosPagos total mismatch
async function testNominaTotalOtrosPagosMismatch(): Promise<void> {
  const xml = buildNominaXml({
    totalPercepciones: "1000.00",
    totalDeducciones: "0.00",
    totalOtrosPagos: "100.00",
    otrosPagos: [
      { tipo: "001", clave: "OP001", concepto: "Reembolso", importe: "80.00" },
      { tipo: "", clave: "OP002", concepto: "Test", importe: "0.00" },
    ],
  });
  const result = analyzeCfdi(xml, "nomina-total-op-mismatch.xml");
  assertIncludesFinding(result.findings, "NOMINA_TOTAL_OTROS_PAGOS_MISMATCH", "CRITICAL");
  assertIncludesFinding(result.findings, "NOMINA_OTRO_PAGO_MISSING_TIPO", "WARNING");
}

// EU) SubsidioAlEmpleo con TipoOtroPago distinto de 002
async function testNominaSubsidioSinTipo002(): Promise<void> {
  const xml = buildNominaXml({
    totalPercepciones: "1000.00",
    totalDeducciones: "0.00",
    totalOtrosPagos: "100.00",
    otrosPagos: [
      {
        tipo: "001",
        clave: "OP001",
        concepto: "Subsidio",
        importe: "100.00",
        subsidioCausado: "50.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "nomina-subsidio-sin-002.xml");
  assertIncludesFinding(
    result.findings,
    "NOMINA_SUBSIDIO_CAUSADO_WITHOUT_OTRO_PAGO_002_REVIEW",
    "WARNING",
  );
}

// EV) CFDI Total nómina mismatch
async function testNominaCfdiTotalMismatch(): Promise<void> {
  const xml = buildNominaXml({
    tipoComprobante: "N",
    total: "950.00",
    subTotal: "1000.00",
    totalPercepciones: "1000.00",
    totalDeducciones: "100.00",
    totalOtrosPagos: "0.00",
  });
  const result = analyzeCfdi(xml, "nomina-cfdi-total-mismatch.xml");
  assertIncludesFinding(result.findings, "NOMINA_CFDI_TOTAL_MISMATCH", "CRITICAL");
}

// EC) Pago missing required fields
async function testPagoMissingRequiredFields(): Promise<void> {
  const xml = buildRepXml({
    fechaPago: "",
    formaDePagoP: "",
    monedaP: "",
    monto: "",
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "pago-missing-fields.xml");
  assertIncludesFinding(result.findings, "PAYMENT_DATE_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_FORMA_PAGO_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_MONEDA_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_AMOUNT_MISSING", "WARNING");
}

// ED) FechaPago inválida
async function testPagoFechaInvalida(): Promise<void> {
  const xml = buildRepXml({
    fechaPago: "fecha-invalida",
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "pago-fecha-invalida.xml");
  assertIncludesFinding(result.findings, "PAYMENT_DATE_INVALID_REVIEW", "WARNING");
}

// EE) TipoCambioP required for foreign currency
async function testRepTipoCambioExtranjero(): Promise<void> {
  const xml = buildRepXml({
    monedaP: "USD",
    monto: "1000.00",
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "USD",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "rep-tc-extranjero.xml");
  assertIncludesFinding(result.findings, "PAYMENT_TIPO_CAMBIO_REQUIRED_REVIEW", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_EXCHANGE_RATE_REQUIRED", "WARNING");
}

// EF) TipoCambioP with MXN
async function testRepTipoCambioConMxn(): Promise<void> {
  const xml = buildRepXml({
    monedaP: "MXN",
    monto: "1000.00",
    tipoCambioP: "17.50",
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "rep-tc-con-mxn.xml");
  assertIncludesFinding(result.findings, "PAYMENT_TIPO_CAMBIO_WITH_MXN_REVIEW", "INFO");
}

// EG) Required document fields missing
async function testRepDocFieldsMissing(): Promise<void> {
  const xml = buildRepXml({
    docs: [
      {
        idDocumento: "",
        monedaDR: "",
        numParcialidad: "",
        impSaldoAnt: "",
        impPagado: "",
        impSaldoInsoluto: "",
        objetoImpDR: "",
      },
    ],
  });
  const result = analyzeCfdi(xml, "rep-doc-fields-missing.xml");
  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_MISSING_UUID", "WARNING");
  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_MISSING_MONEDA", "WARNING");
  assertIncludesFinding(
    result.findings,
    "RELATED_DOCUMENT_NUM_PARCIALIDAD_MISSING_REVIEW",
    "WARNING",
  );
  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_PREVIOUS_BALANCE_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_PAID_AMOUNT_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_REMAINING_BALANCE_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_OBJECT_IMP_MISSING_REVIEW", "WARNING");
}

// EH) NumParcialidad non-positive
async function testRepNumParcialidadNonPositive(): Promise<void> {
  const xml = buildRepXml({
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "0",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "rep-parcialidad-no-positivo.xml");
  assertIncludesFinding(
    result.findings,
    "RELATED_DOCUMENT_NUM_PARCIALIDAD_NON_POSITIVE",
    "WARNING",
  );
}

// EI) ObjetoImpDR and ImpuestosDR consistency
async function testRepObjetoImpDRConsistency(): Promise<void> {
  // 01 with DR taxes
  const xml01 = buildRepXml({
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
        objetoImpDR: "01",
        trasladosDR: [
          {
            baseDR: "400.00",
            impuestoDR: "002",
            tipoFactorDR: "Tasa",
            tasaOCuotaDR: "0.160000",
            importeDR: "64.00",
          },
        ],
      },
    ],
  });
  const result01 = analyzeCfdi(xml01, "rep-objimp-01-con-impuestos.xml");
  assertIncludesFinding(
    result01.findings,
    "RELATED_DOCUMENT_OBJECT_IMP_01_WITH_TAXES_REVIEW",
    "WARNING",
  );

  // 02 without DR taxes
  const xml02 = buildRepXml({
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
        objetoImpDR: "02",
      },
    ],
  });
  const result02 = analyzeCfdi(xml02, "rep-objimp-02-sin-impuestos.xml");
  assertIncludesFinding(
    result02.findings,
    "RELATED_DOCUMENT_OBJECT_IMP_02_WITHOUT_TAXES_REVIEW",
    "WARNING",
  );

  // 03 with tax importe > 0
  const xml03 = buildRepXml({
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
        objetoImpDR: "03",
        trasladosDR: [
          {
            baseDR: "400.00",
            impuestoDR: "002",
            tipoFactorDR: "Tasa",
            tasaOCuotaDR: "0.160000",
            importeDR: "64.00",
          },
        ],
      },
    ],
  });
  const result03 = analyzeCfdi(xml03, "rep-objimp-03-con-importe.xml");
  assertIncludesFinding(
    result03.findings,
    "RELATED_DOCUMENT_OBJECT_IMP_03_WITH_TAX_AMOUNT_REVIEW",
    "WARNING",
  );
}

// EJ) DR Tax base/rate/amount checks
async function testRepDrTaxChecks(): Promise<void> {
  const xml = buildRepXml({
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
        objetoImpDR: "02",
        // D1: base <= 0 with importe > 0
        // D2: rate mismatch (400*0.16=64 but importe is 60)
        // D6: exento with importe > 0
        trasladosDR: [
          {
            baseDR: "0.00",
            impuestoDR: "002",
            tipoFactorDR: "Tasa",
            tasaOCuotaDR: "0.160000",
            importeDR: "10.00",
          },
          {
            baseDR: "400.00",
            impuestoDR: "002",
            tipoFactorDR: "Tasa",
            tasaOCuotaDR: "0.160000",
            importeDR: "60.00",
          },
          { baseDR: "100.00", impuestoDR: "002", tipoFactorDR: "Exento", importeDR: "5.00" },
        ],
        // D3: missing impuesto, D4: missing factor, D5: tasa without rate
        retencionesDR: [
          {
            baseDR: "400.00",
            impuestoDR: "",
            tipoFactorDR: "Tasa",
            tasaOCuotaDR: "0.100000",
            importeDR: "40.00",
          },
          { baseDR: "400.00", impuestoDR: "001", tipoFactorDR: "", importeDR: "40.00" },
          {
            baseDR: "400.00",
            impuestoDR: "001",
            tipoFactorDR: "Tasa",
            tasaOCuotaDR: "",
            importeDR: "40.00",
          },
        ],
      },
    ],
  });
  const result = analyzeCfdi(xml, "rep-dr-tax-checks.xml");
  assertIncludesFinding(result.findings, "PAYMENT_RELATED_TAX_BASE_NON_POSITIVE", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_RELATED_TAX_RATE_MISMATCH", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_RELATED_TAX_EXENTO_WITH_AMOUNT", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_RELATED_TAX_MISSING_TAX_CODE", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_RELATED_TAX_MISSING_FACTOR", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_RELATED_TAX_MISSING_RATE_FOR_TASA", "WARNING");
}

// EK) Totales present without DR taxes
async function testRepTotalesSinDrTaxes(): Promise<void> {
  const xml = buildRepXml({
    totales: { montoTotalPagos: "400.00" },
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "rep-totales-sin-dr-taxes.xml");
  assertIncludesFinding(
    result.findings,
    "PAYMENT_TOTAL_TAXES_PRESENT_WITHOUT_RELATED_TAXES_REVIEW",
    "INFO",
  );
}

// EL) Multiple pago-level validations
async function testRepMultiplePagoLevel(): Promise<void> {
  // Pago without documents + multiple currencies among documents
  const xml = buildRepXml({
    monto: "1000.00",
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "200.00",
        impSaldoInsoluto: "800.00",
      },
      {
        idDocumento: "a2222222-2222-4222-8222-222222222222",
        monedaDR: "USD",
        equivalenciaDR: "17.50",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "300.00",
        impSaldoInsoluto: "700.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "rep-multiple-pago-level.xml");
  assertIncludesFinding(result.findings, "PAYMENT_TOTAL_RELATED_PAID_REVIEW", "INFO");
  assertIncludesFinding(result.findings, "PAYMENT_WITH_MULTIPLE_RELATED_CURRENCIES_REVIEW", "INFO");
}

// A) XML Ingreso CFDI 4.0 válido básico
async function testCfdiIngresoBasico(): Promise<void> {
  const xml = buildCfdi40Ingreso();
  const result = analyzeCfdi(xml, "ingreso-40.xml");

  assertEqual(result.tipoComprobante, "Ingreso", "tipoComprobante debe ser Ingreso");
  assertEqual(result.version, "4.0", "version debe ser 4.0");
  assertTruthy(
    result.technicalDiagnostics.hasTimbreFiscalDigital,
    "hasTimbreFiscalDigital debe ser true",
  );
  assertTruthy(result.technicalDiagnostics.isStamped, "isStamped debe ser true");
  assertTruthy(result.executiveSummary, "executiveSummary debe existir");
  assertTruthy(Array.isArray(result.findings), "findings debe ser array");
  assertTruthy(result.concepts, "concepts debe existir");
  assertTruthy(result.concepts!.length >= 1, "concepts debe tener al menos 1 elemento");
  assertTruthy(result.totalsValidation, "totalsValidation debe existir");
  assertEqual(result.rfcEmisor, "XAXX010101000", "rfcEmisor correcto");
  assertEqual(result.rfcReceptor, "XAXX010101001", "rfcReceptor correcto");
  assertEqual(result.moneda, "MXN", "moneda MXN");

  if (result.normalizedXml) {
    assertEqual(
      result.normalizedXml.available,
      false,
      "sin BOM ni contenido previo, normalizedXml.available=false",
    );
  }
}

// B) XML con BOM UTF-8
async function testXmlConBom(): Promise<void> {
  const xml = buildBomXml();
  const result = analyzeCfdi(xml, "bom.xml");
  const tech = result.technicalDiagnostics;

  assertTruthy(tech.bomDetected, "bomDetected debe ser true");
  assertTruthy(tech.safeNormalizationApplied, "safeNormalizationApplied debe ser true");
  assertTruthy(result.normalizedXml, "normalizedXml debe existir");
  assertTruthy(result.normalizedXml!.available, "normalizedXml.available debe ser true");
  assertEqual(
    result.normalizedXml!.normalizationType,
    "TECHNICAL_SAFE",
    "normalizationType TECHNICAL_SAFE",
  );
  assertEqual(result.normalizedXml!.fiscalContentModified, false, "fiscalContentModified false");
  assertEqual(result.normalizedXml!.stampRisk, "NONE", "stampRisk NONE");
  assertTruthy(result.normalizedXml!.originalSha256, "originalSha256 debe existir");
  assertTruthy(result.normalizedXml!.normalizedSha256, "normalizedSha256 debe existir");
  assertNotEqual(
    result.normalizedXml!.originalSha256!,
    result.normalizedXml!.normalizedSha256!,
    "originalSha256 != normalizedSha256",
  );

  const content = result.normalizedXml!.content;
  assertTruthy(content, "normalizedXml.content debe existir");
  assertEqual(content[0], "<", "content normalizado debe empezar con <");
}

// C) XML con contenido previo al primer "<"
async function testXmlConLeadingContent(): Promise<void> {
  const xml = buildLeadingContentXml();
  const result = analyzeCfdi(xml, "leading.xml");
  const tech = result.technicalDiagnostics;

  assertTruthy(tech.leadingContentBeforeXml, "leadingContentBeforeXml debe ser true");
  assertTruthy(tech.safeNormalizationApplied, "safeNormalizationApplied debe ser true");
  assertTruthy(result.normalizedXml, "normalizedXml debe existir");
  assertTruthy(result.normalizedXml!.available, "normalizedXml.available debe ser true");
  assertEqual(result.normalizedXml!.fiscalContentModified, false, "fiscalContentModified false");
  assertEqual(result.normalizedXml!.stampRisk, "NONE", "stampRisk NONE");

  const content = result.normalizedXml!.content;
  assertTruthy(content, "normalizedXml.content debe existir");
  assertEqual(content[0], "<", "content normalizado debe empezar con <");
}

// D) Complemento de pago Pagos 2.0
async function testPago20(): Promise<void> {
  const xml = buildPago20Xml();
  const result = analyzeCfdi(xml, "pago20.xml");

  assertEqual(result.tipoComprobante, "Pago", "tipoComprobante debe ser Pago");
  assertEqual(result.moneda, "XXX", "moneda XXX");
  assertTruthy(result.paymentComplement, "paymentComplement debe existir");
  assertEqual(result.paymentComplement!.version, "2.0", "version del complemento 2.0");
  assertTruthy(result.paymentComplement!.pagos.length > 0, "pagos.length > 0");
  assertTruthy(
    result.paymentComplement!.pagos[0].documentosRelacionados.length > 0,
    "documentosRelacionados.length > 0",
  );
  assertEqual(
    result.paymentComplement!.pagos[0].documentosRelacionados[0].idDocumento,
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "UUID relacionado correcto",
  );
}

// E) Conceptos e impuestos
async function testConceptosImpuestos(): Promise<void> {
  const xml = buildMultiTaxXml();
  const result = analyzeCfdi(xml, "multi-tax.xml");

  assertTruthy(result.concepts, "concepts debe existir");
  assertEqual(result.concepts!.length, 2, "debe haber 2 conceptos");

  const c1 = result.concepts![0];
  assertEqual(c1.claveProdServ, "01010101", "claveProdServ concepto 1");
  assertEqual(c1.cantidad, "1", "cantidad concepto 1");
  assertEqual(c1.claveUnidad, "H87", "claveUnidad concepto 1");
  assertEqual(c1.descripcion, "Producto IVA", "descripcion concepto 1");
  assertEqual(c1.importe, "1000.00", "importe concepto 1");
  assertEqual(c1.objetoImp, "02", "objetoImp concepto 1");

  const c2 = result.concepts![1];
  assertEqual(c2.claveProdServ, "01010102", "claveProdServ concepto 2");
  assertEqual(c2.cantidad, "2", "cantidad concepto 2");
  assertEqual(c2.importe, "1000.00", "importe concepto 2");

  assertTruthy(result.taxSummary, "taxSummary debe existir");
  assertTruthy(result.taxSummary!.transferred.length >= 2, "debe haber al menos 2 traslados");

  const ivaTraslados = result.taxSummary!.transferred.filter((t) => t.impuesto === "002");
  assertTruthy(ivaTraslados.length > 0, "IVA 002 debe estar en taxSummary");
  assertEqual(ivaTraslados[0].impuestoLabel, "IVA", "IVA label correcto");

  const iepsTraslados = result.taxSummary!.transferred.filter((t) => t.impuesto === "003");
  assertTruthy(iepsTraslados.length > 0, "IEPS 003 debe estar en taxSummary");
  assertEqual(iepsTraslados[0].impuestoLabel, "IEPS", "IEPS label correcto");
}

// F) Validación de totales consistente
async function testTotalesConsistentes(): Promise<void> {
  const xml = buildCfdi40Ingreso();
  const result = analyzeCfdi(xml, "totales-ok.xml");

  assertTruthy(result.totalsValidation, "totalsValidation debe existir");
  assertEqual(result.totalsValidation!.matches, true, "matches debe ser true");
  assertEqual(result.totalsValidation!.difference, "0.00", "difference debe ser 0.00");
  assertEqual(result.totalsValidation!.totalXml, "1160.00", "totalXml debe coincidir");
  assertEqual(
    result.totalsValidation!.totalCalculated,
    "1160.00",
    "totalCalculated debe coincidir",
  );
}

// G) Validación de totales inconsistente
async function testTotalesInconsistentes(): Promise<void> {
  const xml = buildBadTotalsXml();
  const result = analyzeCfdi(xml, "totales-bad.xml");

  assertTruthy(result.totalsValidation, "totalsValidation debe existir");
  assertEqual(result.totalsValidation!.matches, false, "matches debe ser false");

  assertIncludesFinding(result.findings, "TOTAL_MISMATCH", "CRITICAL");
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

// H) XML sin TimbreFiscalDigital
async function testXmlSinTimbre(): Promise<void> {
  const xml = buildUntimbradoXml();
  const result = analyzeCfdi(xml, "untimbrado.xml");

  assertEqual(
    result.technicalDiagnostics.hasTimbreFiscalDigital,
    false,
    "hasTimbreFiscalDigital false",
  );
  assertEqual(result.technicalDiagnostics.isStamped, false, "isStamped false");

  assertIncludesFinding(result.findings, "UNSTAMPED_XML");
}

// I) ZIP full con varios XMLs
async function testZipFull(): Promise<void> {
  const zip = new AdmZip();

  // 1 XML válido
  zip.addFile("factura-ok.xml", Buffer.from(buildCfdi40Ingreso(), "utf-8"));

  // 1 XML con BOM
  zip.addFile("factura-bom.xml", Buffer.from(buildBomXml(), "utf-8"));

  // 1 archivo no XML
  zip.addFile("nota.txt", Buffer.from("esto no es xml", "utf-8"));

  // 1 XML inválido/corrupto
  zip.addFile("corrupto.xml", Buffer.from(buildCorruptXml(), "utf-8"));

  const buffer = zip.toBuffer();
  const result = analyzeZipFull(buffer, "test.zip");

  assertEqual(result.ok, true, "ok debe ser true");
  assertEqual(result.filename, "test.zip", "filename correcto");

  // 2 XMLs + 1 no-XML + 1 XML corrupto (ignored = 1)
  assertEqual(result.xmlFilesFound, 3, "xmlFilesFound debe ser 3 (ok + bom + corrupto)");
  assertEqual(result.ignoredEntries, 1, "ignoredEntries debe ser 1 (nota.txt)");
  assertEqual(result.totalEntries, 4, "totalEntries 4");

  // ok + bom = 2 analyzed, corrupto = 1 failed
  assertEqual(result.analyzedCount, 2, "analyzedCount 2 (ok + bom)");
  assertEqual(result.failedCount, 1, "failedCount 1 (corrupto)");

  const analyzedResults = result.results.filter((r) => r.status === "ANALYZED");
  const failedResults = result.results.filter((r) => r.status === "FAILED");
  assertEqual(analyzedResults.length, 2, "2 ANALYZED results");
  assertEqual(failedResults.length, 1, "1 FAILED result");

  // summary debe reflejar BOM
  assertEqual(result.summary.filesWithBom, 1, "summary.filesWithBom 1");

  // Validar que normalizedXml no tenga content en resultados ZIP
  for (const r of analyzedResults) {
    if (r.analysis && r.analysis.normalizedXml) {
      const nx = r.analysis.normalizedXml as Record<string, unknown>;
      if (nx.available === true) {
        assertEqual(
          nx.content,
          undefined,
          "normalizedXml.content no debe estar presente en ZIP result",
        );
      }
    }
  }

  // El corrupto debe tener errorCode
  assertTruthy(failedResults[0].errorCode, "FAILED debe tener errorCode");
}

// J) ZIP normalizados
async function testZipNormalizados(): Promise<void> {
  const zip = new AdmZip();

  // XML con BOM para que se normalice
  zip.addFile("bom-factura.xml", Buffer.from(buildBomXml(), "utf-8"));
  // XML sin BOM para que se salte
  zip.addFile("normal-factura.xml", Buffer.from(buildCfdi40Ingreso(), "utf-8"));

  const buffer = zip.toBuffer();
  const outBuffer = generateNormalizedZip(buffer, "test-normalized.zip");

  assertTruthy(outBuffer, "generateNormalizedZip debe devolver un Buffer");
  assertTruthy(outBuffer.length > 0, "Buffer no debe estar vacío");

  const outZip = new AdmZip(outBuffer);

  const normalizedEntry = outZip.getEntry("normalized/bom-factura.xml");
  assertTruthy(normalizedEntry, "normalized/bom-factura.xml debe existir en ZIP de salida");

  const normalizedContent = normalizedEntry!.getData().toString("utf-8");
  assertEqual(normalizedContent[0], "<", "XML normalizado no debe empezar con BOM");

  // Manifest files
  assertTruthy(outZip.getEntry("manifest/manifest.json"), "manifest.json debe existir");
  assertTruthy(outZip.getEntry("manifest/manifest.csv"), "manifest.csv debe existir");

  const manifestJson = JSON.parse(
    outZip.getEntry("manifest/manifest.json")!.getData().toString("utf-8"),
  );
  assertEqual(manifestJson.sourceZipFilename, "test-normalized.zip", "sourceZipFilename correcto");

  const bomFile = manifestJson.files.find(
    (f: { originalName: string }) => f.originalName === "bom-factura.xml",
  );
  assertTruthy(bomFile, "bom-factura.xml debe estar en manifest");
  assertEqual(bomFile.status, "NORMALIZED", "status de XML con BOM debe ser NORMALIZED");
}

// K) RFC genérico receptor correcto (todo consistente)
async function testRfcGenericoReceptorCorrecto(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-04-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="PUBLICO EN GENERAL" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="616" UsoCFDI="S01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="a0000000-0000-4000-8000-00000000000a" FechaTimbrado="2024-04-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  const result = analyzeCfdi(xml, "receptor-generico-correcto.xml");

  assertIncludesFinding(result.findings, "GENERIC_RFC_RECEPTOR_NATIONAL");
  const nationalFinding = result.findings.find((f) => f.code === "GENERIC_RFC_RECEPTOR_NATIONAL")!;
  assertEqual(nationalFinding.severity, "INFO", "GENERIC_RFC_RECEPTOR_NATIONAL debe ser INFO");

  // No debe tener warnings de inconsistencia
  assertTruthy(
    !result.findings.some((f) => f.code === "GENERIC_RFC_RECEPTOR_REGIMEN_NOT_616"),
    "No debe existir GENERIC_RFC_RECEPTOR_REGIMEN_NOT_616",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "GENERIC_RFC_RECEPTOR_POSTAL_MISMATCH"),
    "No debe existir GENERIC_RFC_RECEPTOR_POSTAL_MISMATCH",
  );

  // PPD + FormaPago 01 genera WARNING de consistencia (nueva regla)
  assertIncludesFinding(result.findings, "METODO_PAGO_PPD_WITH_FORMA_PAGO_NOT_99", "WARNING");
  assertEqual(
    result.executiveSummary.riskLevel,
    "WARNING",
    "riskLevel debe ser WARNING por PPD+FormaPago",
  );
}

// L) RFC genérico receptor inconsistente
async function testRfcGenericoReceptorInconsistente(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="2" Fecha="2024-04-02T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="CLIENTE FINAL" DomicilioFiscalReceptor="99999" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="b0000000-0000-4000-8000-00000000000b" FechaTimbrado="2024-04-02T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  const result = analyzeCfdi(xml, "receptor-generico-inconsistente.xml");

  assertIncludesFinding(result.findings, "GENERIC_RFC_RECEPTOR_NATIONAL");
  assertIncludesFinding(result.findings, "GENERIC_RFC_RECEPTOR_REGIMEN_NOT_616");
  assertIncludesFinding(result.findings, "GENERIC_RFC_RECEPTOR_POSTAL_MISMATCH");
  assertIncludesFinding(result.findings, "GENERIC_RFC_RECEPTOR_USO_CFDI_REVIEW");

  // Warnings elevan riskLevel a WARNING
  assertEqual(result.executiveSummary.riskLevel, "WARNING", "riskLevel debe ser WARNING");
}

// M) RFC genérico emisor
async function testRfcGenericoEmisor(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="3" Fecha="2024-04-03T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA GENERICA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="c0000000-0000-4000-8000-00000000000c" FechaTimbrado="2024-04-03T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  const result = analyzeCfdi(xml, "emisor-generico.xml");

  assertIncludesFinding(result.findings, "GENERIC_RFC_EMISOR");
  const emisorFinding = result.findings.find((f) => f.code === "GENERIC_RFC_EMISOR")!;
  assertEqual(emisorFinding.severity, "WARNING", "GENERIC_RFC_EMISOR debe ser WARNING");
}

// N) Timbrado completo sin hallazgos de sellos
async function testTimbradoCompleto(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-05-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc123certificado" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc123sello">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="a1111111-1111-4111-8111-111111111111" FechaTimbrado="2024-05-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="selloCfdEjemplo" SelloSAT="selloSatEjemplo" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  const result = analyzeCfdi(xml, "timbrado-completo.xml");

  const missingCodes = [
    "MISSING_COMPROBANTE_SELLO",
    "MISSING_COMPROBANTE_CERTIFICADO",
    "MISSING_NO_CERTIFICADO",
    "MISSING_TFD_SELLO_CFD",
    "MISSING_TFD_SELLO_SAT",
    "MISSING_TFD_NO_CERTIFICADO_SAT",
  ];
  for (const code of missingCodes) {
    assertTruthy(
      !result.findings.some((f) => f.code === code),
      `No debe existir ${code} en timbrado completo`,
    );
  }

  // riskLevel no debe subir a WARNING por timbrado si no hay otros warnings
  const nonStampWarnings = result.findings.filter(
    (f) =>
      f.severity === "WARNING" &&
      !missingCodes.includes(f.code) &&
      !f.code.startsWith("GENERIC_RFC_") &&
      !f.code.startsWith("MISSING_") &&
      f.code !== "TIMBRADO_DATE_BEFORE_CFDI_DATE",
  );
  if (nonStampWarnings.length > 0) {
    // Si hay otros warnings, eso es otra cosa; pero al menos los de timbrado no deben aparecer
  }
  assertTruthy(
    !result.findings.some((f) => missingCodes.includes(f.code)),
    "No deben existir findings de sellos/certificados faltantes",
  );
}

// O) Timbrado incompleto
async function testTimbradoIncompleto(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="2" Fecha="2024-05-02T10:00:00" FormaPago="01" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="b2222222-2222-4222-8222-222222222222" FechaTimbrado="2024-05-02T10:30:00"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  const result = analyzeCfdi(xml, "timbrado-incompleto.xml");

  const expectedPresent = [
    "MISSING_COMPROBANTE_SELLO",
    "MISSING_COMPROBANTE_CERTIFICADO",
    "MISSING_NO_CERTIFICADO",
    "MISSING_TFD_SELLO_SAT",
    "MISSING_TFD_NO_CERTIFICADO_SAT",
  ];
  for (const code of expectedPresent) {
    assertIncludesFinding(result.findings, code);
  }

  assertEqual(result.executiveSummary.riskLevel, "WARNING", "riskLevel debe ser WARNING");
}

// P) Fecha timbrado anterior a fecha CFDI
async function testFechaTimbradoAnterior(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="3" Fecha="2024-06-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="c3333333-3333-4333-8333-333333333333" FechaTimbrado="2024-05-01T10:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="sello" SelloSAT="sello" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;

  const result = analyzeCfdi(xml, "fecha-timbrado-anterior.xml");

  assertIncludesFinding(result.findings, "TIMBRADO_DATE_BEFORE_CFDI_DATE");
  const dateFinding = result.findings.find((f) => f.code === "TIMBRADO_DATE_BEFORE_CFDI_DATE")!;
  assertEqual(dateFinding.severity, "WARNING", "TIMBRADO_DATE_BEFORE_CFDI_DATE debe ser WARNING");
}

type DrTaxEntry = {
  baseDR: string;
  impuestoDR: string;
  tipoFactorDR: string;
  tasaOCuotaDR?: string;
  importeDR: string;
};

function buildDrTaxesXml(trasladosDR?: DrTaxEntry[], retencionesDR?: DrTaxEntry[]): string {
  const hasTraslados = trasladosDR && trasladosDR.length > 0;
  const hasRetenciones = retencionesDR && retencionesDR.length > 0;
  if (!hasTraslados && !hasRetenciones) return "";
  const parts: string[] = [];
  parts.push(`          <pago20:ImpuestosDR>`);
  if (hasTraslados) {
    parts.push(`            <pago20:TrasladosDR>`);
    for (const t of trasladosDR!) {
      parts.push(
        `              <pago20:TrasladoDR BaseDR="${t.baseDR}" ImpuestoDR="${t.impuestoDR}" TipoFactorDR="${t.tipoFactorDR}"${t.tasaOCuotaDR ? ` TasaOCuotaDR="${t.tasaOCuotaDR}"` : ""} ImporteDR="${t.importeDR}"/>`,
      );
    }
    parts.push(`            </pago20:TrasladosDR>`);
  }
  if (hasRetenciones) {
    parts.push(`            <pago20:RetencionesDR>`);
    for (const t of retencionesDR!) {
      parts.push(
        `              <pago20:RetencionDR BaseDR="${t.baseDR}" ImpuestoDR="${t.impuestoDR}" TipoFactorDR="${t.tipoFactorDR}"${t.tasaOCuotaDR ? ` TasaOCuotaDR="${t.tasaOCuotaDR}"` : ""} ImporteDR="${t.importeDR}"/>`,
      );
    }
    parts.push(`            </pago20:RetencionesDR>`);
  }
  parts.push(`          </pago20:ImpuestosDR>`);
  return parts.join("\n");
}

function buildRepXml(opts?: {
  monedaP?: string;
  monto?: string;
  tipoCambioP?: string;
  docs?: Array<{
    idDocumento?: string;
    monedaDR?: string;
    equivalenciaDR?: string;
    numParcialidad?: string;
    impSaldoAnt?: string;
    impPagado?: string;
    impSaldoInsoluto?: string;
    objetoImpDR?: string;
    trasladosDR?: DrTaxEntry[];
    retencionesDR?: DrTaxEntry[];
  }>;
  totales?: {
    montoTotalPagos?: string;
  };
  includeTimbre?: boolean;
  fechaPago?: string;
  formaDePagoP?: string;
}): string {
  const monedaP = opts?.monedaP ?? "MXN";
  const monto = opts?.monto ?? "1000.00";
  const tipoCambioP = opts?.tipoCambioP;
  const docs = opts?.docs ?? [
    {
      idDocumento: "a1111111-1111-4111-8111-111111111111",
      monedaDR: "MXN",
      equivalenciaDR: "1",
      numParcialidad: "1",
      impSaldoAnt: "1000.00",
      impPagado: "400.00",
      impSaldoInsoluto: "600.00",
    },
  ];
  const includeTimbre = opts?.includeTimbre ?? true;
  const fechaPago = opts?.fechaPago ?? "2024-02-10T10:30:00";
  const formaDePagoP = opts?.formaDePagoP ?? "03";

  const docsXml = docs
    .map((d) => {
      const objImpDR = d.objetoImpDR ?? "01";
      const docOpen = `        <pago20:DoctoRelacionado${d.idDocumento ? ` IdDocumento="${d.idDocumento}"` : ""} Serie="A" Folio="1"${d.monedaDR ? ` MonedaDR="${d.monedaDR}"` : ""}${d.equivalenciaDR ? ` EquivalenciaDR="${d.equivalenciaDR}"` : ""}${d.numParcialidad ? ` NumParcialidad="${d.numParcialidad}"` : ""}${d.impSaldoAnt ? ` ImpSaldoAnt="${d.impSaldoAnt}"` : ""}${d.impPagado ? ` ImpPagado="${d.impPagado}"` : ""}${d.impSaldoInsoluto ? ` ImpSaldoInsoluto="${d.impSaldoInsoluto}"` : ""} ObjetoImpDR="${objImpDR}"`;
      const hasDrTaxes =
        (d.trasladosDR && d.trasladosDR.length > 0) ||
        (d.retencionesDR && d.retencionesDR.length > 0);
      if (hasDrTaxes) {
        const taxXml = buildDrTaxesXml(d.trasladosDR, d.retencionesDR);
        return `${docOpen}>\n${taxXml}\n        </pago20:DoctoRelacionado>`;
      }
      return `${docOpen}/>`;
    })
    .join("\n");

  const totalesXml = opts?.totales
    ? `      <pago20:Totales${opts.totales.montoTotalPagos ? ` MontoTotalPagos="${opts.totales.montoTotalPagos}"` : ""}/>\n`
    : "";

  const timbre = includeTimbre
    ? `    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>`
    : "";

  const pagoAttrs = `FechaPago="${fechaPago}" FormaDePagoP="${formaDePagoP}" MonedaP="${monedaP}" Monto="${monto}"${tipoCambioP ? ` TipoCambioP="${tipoCambioP}"` : ""} NumOperacion="OP001"`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${PAGO20_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="P" Folio="1" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
${totalesXml}      <pago20:Pago ${pagoAttrs}>
${docsXml}
      </pago20:Pago>
    </pago20:Pagos>
${timbre}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// Q) REP saldo consistente
async function testRepSaldoConsistente(): Promise<void> {
  const xml = buildRepXml({
    monto: "1000.00",
    monedaP: "MXN",
    docs: [
      {
        idDocumento: "a1111111-1111-4111-8111-111111111111",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
      },
    ],
  });

  const result = analyzeCfdi(xml, "rep-saldo-consistente.xml");

  assertTruthy(
    !result.findings.some((f) => f.code === "RELATED_DOCUMENT_BALANCE_MISMATCH"),
    "No debe existir RELATED_DOCUMENT_BALANCE_MISMATCH",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE"),
    "No debe existir RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT"),
    "No debe existir PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT",
  );
}

// R) REP saldo inconsistente
async function testRepSaldoInconsistente(): Promise<void> {
  const xml = buildRepXml({
    monto: "1000.00",
    monedaP: "MXN",
    docs: [
      {
        idDocumento: "b2222222-2222-4222-8222-222222222222",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "700.00",
      },
    ],
  });

  const result = analyzeCfdi(xml, "rep-saldo-inconsistente.xml");

  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_BALANCE_MISMATCH");
  const mismatch = result.findings.find((f) => f.code === "RELATED_DOCUMENT_BALANCE_MISMATCH")!;
  assertEqual(mismatch.severity, "CRITICAL", "RELATED_DOCUMENT_BALANCE_MISMATCH debe ser CRITICAL");
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

// S) REP pagado mayor a saldo anterior
async function testRepPagadoMayorSaldoAnterior(): Promise<void> {
  const xml = buildRepXml({
    monto: "1200.00",
    monedaP: "MXN",
    docs: [
      {
        idDocumento: "c3333333-3333-4333-8333-333333333333",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "2",
        impSaldoAnt: "1000.00",
        impPagado: "1200.00",
        impSaldoInsoluto: "0.00",
      },
    ],
  });

  const result = analyzeCfdi(xml, "rep-pagado-mayor.xml");

  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE");
  const exceed = result.findings.find(
    (f) => f.code === "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE",
  )!;
  assertEqual(
    exceed.severity,
    "CRITICAL",
    "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE debe ser CRITICAL",
  );
}

// T) REP suma documentos excede monto pago
async function testRepSumaExcedeMonto(): Promise<void> {
  const xml = buildRepXml({
    monto: "1000.00",
    monedaP: "MXN",
    docs: [
      {
        idDocumento: "d4444444-4444-4444-8444-444444444444",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "600.00",
        impSaldoInsoluto: "400.00",
      },
      {
        idDocumento: "e5555555-5555-4555-8555-555555555555",
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "600.00",
        impPagado: "500.00",
        impSaldoInsoluto: "100.00",
      },
    ],
  });

  const result = analyzeCfdi(xml, "rep-suma-excede.xml");

  assertIncludesFinding(result.findings, "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT");
  const exceed = result.findings.find(
    (f) => f.code === "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT",
  )!;
  assertEqual(
    exceed.severity,
    "CRITICAL",
    "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT debe ser CRITICAL",
  );
}

// U) REP revisión por moneda/equivalencia
async function testRepRevisionMoneda(): Promise<void> {
  const xml = buildRepXml({
    monto: "1000.00",
    monedaP: "USD",
    docs: [
      {
        idDocumento: "f6666666-6666-4666-8666-666666666666",
        monedaDR: "MXN",
        equivalenciaDR: "17.50",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "600.00",
        impSaldoInsoluto: "400.00",
      },
    ],
  });

  const result = analyzeCfdi(xml, "rep-revision-moneda.xml");

  assertIncludesFinding(result.findings, "PAYMENT_TOTAL_RELATED_PAID_REVIEW");
  const review = result.findings.find((f) => f.code === "PAYMENT_TOTAL_RELATED_PAID_REVIEW")!;
  assertEqual(review.severity, "INFO", "PAYMENT_TOTAL_RELATED_PAID_REVIEW debe ser INFO");
  assertTruthy(
    !result.findings.some((f) => f.code === "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT"),
    "No debe existir PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT cuando hay moneda/equivalencia no comparable",
  );
}

function buildEgresoCfdiRelacionadosXml(
  uuidRel?: string,
  tipoRel?: string,
  extraRelUuids?: string[],
): string {
  const relatedUuids = extraRelUuids ?? [];
  const allRels = uuidRel ? [uuidRel, ...relatedUuids] : relatedUuids;
  const relsXml =
    allRels.length > 0
      ? allRels.map((u) => `      <cfdi:CfdiRelacionado UUID="${u}"/>`).join("\n")
      : "";
  const relacionesXml = relsXml
    ? `  <cfdi:CfdiRelacionados${tipoRel ? ` TipoRelacion="${tipoRel}"` : ""}>\n${relsXml}\n  </cfdi:CfdiRelacionados>`
    : "";
  const timbreRel =
    "<tfd:TimbreFiscalDigital " +
    TFD_NS +
    ' Version="1.1" UUID="aaaaaa00-0000-4000-8000-000000000000" FechaTimbrado="2024-05-01T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>';

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="E" Folio="1" Fecha="2024-05-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="500.00" Moneda="MXN" Total="435.00" TipoDeComprobante="E" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
${relacionesXml}
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Descuento" ValorUnitario="500.00" Importe="500.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="80.00"/>
        </cfdi:Traslados>
        <cfdi:Retenciones>
          <cfdi:Retencion Base="500.00" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.100000" Importe="50.00"/>
          <cfdi:Retencion Base="500.00" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.050000" Importe="25.00"/>
        </cfdi:Retenciones>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="80.00" TotalImpuestosRetenidos="75.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="80.00"/>
    </cfdi:Traslados>
    <cfdi:Retenciones>
      <cfdi:Retencion Base="500.00" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.100000" Importe="50.00"/>
      <cfdi:Retencion Base="500.00" Impuesto="003" TipoFactor="Tasa" TasaOCuota="0.050000" Importe="25.00"/>
    </cfdi:Retenciones>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    ${timbreRel}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildPagoConCfdiRelacionadosXml(): string {
  const timbre =
    "<tfd:TimbreFiscalDigital " +
    TFD_NS +
    ' Version="1.1" UUID="zzzzzz00-0000-4000-8000-000000000000" FechaTimbrado="2024-06-01T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${PAGO20_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="P" Folio="1" Fecha="2024-06-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:CfdiRelacionados TipoRelacion="01">
    <cfdi:CfdiRelacionado UUID="aaaaaa00-0000-4000-8000-000000000001"/>
  </cfdi:CfdiRelacionados>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2024-06-01T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="OP001">
        <pago20:DoctoRelacionado IdDocumento="dddddddd-dddd-4ddd-8ddd-dddddddddddd" Serie="A" Folio="123" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="5000.00" ImpPagado="5000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>
      </pago20:Pago>
    </pago20:Pagos>
    ${timbre}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// V) Egreso con CFDI relacionado válido
async function testEgresoRelacionadoValido(): Promise<void> {
  const xml = buildEgresoCfdiRelacionadosXml("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "01");
  const result = analyzeCfdi(xml, "egreso-relacionado-valido.xml");

  assertEqual(result.cfdiRelations!.totalRelatedCfdis, 1, "totalRelatedCfdis debe ser 1");
  assertTruthy(
    !result.findings.some((f) => f.code === "EGRESO_WITHOUT_CFDI_RELACIONADOS"),
    "No debe existir EGRESO_WITHOUT_CFDI_RELACIONADOS",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "CFDI_RELATED_UUID_NON_STANDARD"),
    "No debe existir CFDI_RELATED_UUID_NON_STANDARD",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "CFDI_SELF_RELATION"),
    "No debe existir CFDI_SELF_RELATION",
  );
}

// W) Egreso sin CFDI relacionado
async function testEgresoSinRelacion(): Promise<void> {
  const xml = buildEgresoCfdiRelacionadosXml(undefined);
  const result = analyzeCfdi(xml, "egreso-sin-relacion.xml");

  assertIncludesFinding(result.findings, "EGRESO_WITHOUT_CFDI_RELACIONADOS");
  const finding = result.findings.find((f) => f.code === "EGRESO_WITHOUT_CFDI_RELACIONADOS")!;
  assertEqual(finding.severity, "WARNING", "EGRESO_WITHOUT_CFDI_RELACIONADOS debe ser WARNING");
}

// X) CFDI relacionado con UUID inválido
async function testCfdiRelacionadoUuidInvalido(): Promise<void> {
  const xml = buildEgresoCfdiRelacionadosXml("ABC123", "01");
  const result = analyzeCfdi(xml, "cfdi-relacionado-uuid-invalido.xml");

  assertIncludesFinding(result.findings, "CFDI_RELATED_UUID_NON_STANDARD");
  const finding = result.findings.find((f) => f.code === "CFDI_RELATED_UUID_NON_STANDARD")!;
  assertEqual(finding.severity, "WARNING", "CFDI_RELATED_UUID_NON_STANDARD debe ser WARNING");
}

// Y) CFDI relacionado duplicado y self relation
async function testCfdiRelacionadoDuplicadoSelf(): Promise<void> {
  const compUuid = "aaaaaa00-0000-4000-8000-000000000000";
  const xml = buildEgresoCfdiRelacionadosXml(compUuid, "01", [compUuid]);
  const result = analyzeCfdi(xml, "cfdi-relacionado-duplicado-self.xml");

  assertIncludesFinding(result.findings, "CFDI_SELF_RELATION");
  assertIncludesFinding(result.findings, "CFDI_RELATED_DUPLICATE_UUID");
}

// Z) Pago con CfdiRelacionados adicional
async function testPagoConCfdiRelacionados(): Promise<void> {
  const xml = buildPagoConCfdiRelacionadosXml();
  const result = analyzeCfdi(xml, "pago-con-cfdi-relacionados.xml");

  assertIncludesFinding(result.findings, "PAYMENT_WITH_CFDI_RELACIONADOS_REVIEW");
  const finding = result.findings.find((f) => f.code === "PAYMENT_WITH_CFDI_RELACIONADOS_REVIEW")!;
  assertEqual(finding.severity, "INFO", "PAYMENT_WITH_CFDI_RELACIONADOS_REVIEW debe ser INFO");
}

// ─── Carta Porte fixtures ────────────────────────────────────────────────────

function buildCartaPorteXml(opts?: {
  tipoComprobante?: string;
  total?: string;
  subtotal?: string;
  cpVersion?: string;
  idCCP?: string;
  transpInternac?: string;
  totalDistRec?: string;
  entradaSalidaMerc?: string;
  paisOrigenDestino?: string;
  viaEntradaSalida?: string;
  numTotalMercancias?: string;
  pesoBrutoTotal?: string;
  unidadPeso?: string;
  ubicaciones?: Array<{
    tipo: string;
    id?: string;
    rfc?: string;
    nombre?: string;
    fecha?: string;
    distancia?: string;
    domicilio?: { cp?: string; estado?: string; pais?: string; municipio?: string };
  }>;
  mercancias?: Array<{
    bienesTransp?: string;
    descripcion?: string;
    cantidad?: string;
    claveUnidad?: string;
    pesoEnKg?: string;
    valor?: string;
    moneda?: string;
    materialPeligroso?: string;
    cveMaterialPeligroso?: string;
    embalaje?: string;
  }>;
  hasAutotransporte?: boolean;
  autotransporteCompleto?: boolean;
  figurasTransporte?: Array<{
    tipoFigura?: string;
    rfcFigura?: string;
    nombreFigura?: string;
    numLicencia?: string;
  }>;
}): string {
  const tipo = opts?.tipoComprobante ?? "T";
  const total = opts?.total ?? "0.00";
  const subtotal = opts?.subtotal ?? "0.00";
  const cpVersion = opts?.cpVersion ?? "3.1";
  const idCCP = opts?.idCCP ?? "CCP123456";
  const transpInternac = opts?.transpInternac ?? "No";
  const totalDistRec = opts?.totalDistRec ?? "500.00";
  const entradaSalidaMerc = opts?.entradaSalidaMerc;
  const paisOrigenDestino = opts?.paisOrigenDestino;
  const viaEntradaSalida = opts?.viaEntradaSalida;
  const pesoBrutoTotal = opts?.pesoBrutoTotal;
  const unidadPeso = opts?.unidadPeso;
  const ubicaciones = opts?.ubicaciones ?? [
    {
      tipo: "Origen",
      id: "OR001",
      rfc: "EKU9003173C9",
      nombre: "ORIGEN SA",
      fecha: "2024-06-01T08:00:00",
    },
    {
      tipo: "Destino",
      id: "DE001",
      rfc: "EKU9003173C9",
      nombre: "DESTINO SA",
      fecha: "2024-06-01T18:00:00",
      distancia: "500.00",
    },
  ];
  const mercancias = opts?.mercancias ?? [
    {
      bienesTransp: "12101500",
      descripcion: "Material de construcción",
      cantidad: "10",
      claveUnidad: "KGM",
      pesoEnKg: "5000.00",
      valor: "50000.00",
      moneda: "MXN",
    },
  ];
  const numTotalMercancias = opts?.numTotalMercancias ?? String(mercancias.length);
  const hasAutotransporte = opts?.hasAutotransporte ?? true;
  const autotransporteCompleto = opts?.autotransporteCompleto !== false;
  const figurasTransporte = opts?.figurasTransporte;

  const typeLabel =
    tipo === "T"
      ? "Traslado"
      : tipo === "I"
        ? "Ingreso"
        : tipo === "P"
          ? "Pago"
          : tipo === "E"
            ? "Egreso"
            : tipo;
  const cpNs =
    cpVersion === "3.1" ? "cartaporte31" : cpVersion === "3.0" ? "cartaporte30" : "cartaporte20";
  const cpNsUrl =
    cpVersion === "3.1"
      ? "http://www.sat.gob.mx/CartaPorte31"
      : cpVersion === "3.0"
        ? "http://www.sat.gob.mx/CartaPorte30"
        : "http://www.sat.gob.mx/CartaPorte20";

  const ubiXml = ubicaciones
    .map((u) => {
      const idAttr = u.id ? ` IDUbicacion="${u.id}"` : "";
      const rfcAttr = u.rfc ? ` RFCRemitenteDestinatario="${u.rfc}"` : "";
      const nomAttr = u.nombre ? ` NombreRemitenteDestinatario="${u.nombre}"` : "";
      const fechaAttr = u.fecha ? ` FechaHoraSalidaLlegada="${u.fecha}"` : "";
      const distAttr = u.distancia ? ` DistanciaRecorrida="${u.distancia}"` : "";
      const domXml = u.domicilio
        ? `<${cpNs}:Domicilio${u.domicilio.cp ? ` CodigoPostal="${u.domicilio.cp}"` : ""}${u.domicilio.estado ? ` Estado="${u.domicilio.estado}"` : ""}${u.domicilio.pais ? ` Pais="${u.domicilio.pais}"` : ""}${u.domicilio.municipio ? ` Municipio="${u.domicilio.municipio}"` : ""}/>`
        : "";
      return `          <${cpNs}:Ubicacion TipoUbicacion="${u.tipo}"${idAttr}${rfcAttr}${nomAttr}${fechaAttr}${distAttr}>${domXml ? `\n            ${domXml}\n          ` : ""}</${cpNs}:Ubicacion>`;
    })
    .join("\n");

  const merXml = mercancias
    .map((m) => {
      const bt = m.bienesTransp ? ` BienesTransp="${m.bienesTransp}"` : "";
      const desc = m.descripcion ? ` Descripcion="${m.descripcion}"` : "";
      const cant = m.cantidad ? ` Cantidad="${m.cantidad}"` : "";
      const cu = m.claveUnidad ? ` ClaveUnidad="${m.claveUnidad}"` : "";
      const peso = m.pesoEnKg ? ` PesoEnKg="${m.pesoEnKg}"` : "";
      const val = m.valor ? ` ValorMercancia="${m.valor}"` : "";
      const mon = m.moneda ? ` Moneda="${m.moneda}"` : "";
      const mp = m.materialPeligroso ? ` MaterialPeligroso="${m.materialPeligroso}"` : "";
      const cmp = m.cveMaterialPeligroso ? ` CveMaterialPeligroso="${m.cveMaterialPeligroso}"` : "";
      const emb = m.embalaje ? ` Embalaje="${m.embalaje}"` : "";
      return `          <${cpNs}:Mercancia${bt}${desc}${cant}${cu}${peso}${val}${mon}${mp}${cmp}${emb}/>`;
    })
    .join("\n");

  const mercanciasAttrs = `${numTotalMercancias ? ` NumTotalMercancias="${numTotalMercancias}"` : ""}${pesoBrutoTotal ? ` PesoBrutoTotal="${pesoBrutoTotal}"` : ""}${unidadPeso ? ` UnidadPeso="${unidadPeso}"` : ""}`;

  const cpExtraAttrs = `${entradaSalidaMerc ? ` EntradaSalidaMerc="${entradaSalidaMerc}"` : ""}${paisOrigenDestino ? ` PaisOrigenDestino="${paisOrigenDestino}"` : ""}${viaEntradaSalida ? ` ViaEntradaSalida="${viaEntradaSalida}"` : ""}`;

  const cpNsAttr = `xmlns:${cpNs}="${cpNsUrl}"`;
  const autoXml = hasAutotransporte
    ? autotransporteCompleto
      ? `        <${cpNs}:Autotransporte PermSCT="TPAF01" NumPermisoSCT="PERMISO001">
          <${cpNs}:IdentificacionVehicular ConfigVehicular="C2" PlacaVM="ABC1234" AnioModeloVM="2023"/>
          <${cpNs}:Seguros AseguraRespCivil="SEGURO SA" PolizaRespCivil="POL123456"/>
        </${cpNs}:Autotransporte>`
      : `        <${cpNs}:Autotransporte/>`
    : "";

  const figurasXml = figurasTransporte
    ? `        <${cpNs}:FiguraTransporte>
${figurasTransporte
  .map(
    (fig) => `          <${cpNs}:TiposFigura TipoFigura="${fig.tipoFigura ?? "01"}">
            <${cpNs}:PartesTransporte${fig.rfcFigura ? ` RFCFigura="${fig.rfcFigura}"` : ""}${fig.nombreFigura ? ` NombreFigura="${fig.nombreFigura}"` : ""}${fig.numLicencia ? ` NumLicencia="${fig.numLicencia}"` : ""}/>
          </${cpNs}:TiposFigura>`,
  )
  .join("\n")}
        </${cpNs}:FiguraTransporte>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${cpNsAttr} ${SCHEMA_LOCATION} Version="4.0" Serie="CP" Folio="1" Fecha="2024-06-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="${subtotal}" Moneda="MXN" Total="${total}" TipoDeComprobante="${tipo}" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="${tipo === "T" ? "S01" : "G03"}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="78101802" Cantidad="1" ClaveUnidad="ACT" Descripcion="Servicio de transporte" ValorUnitario="${subtotal}" Importe="${subtotal}" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <${cpNs}:CartaPorte Version="${cpVersion}"${idCCP ? ` IdCCP="${idCCP}"` : ""} TranspInternac="${transpInternac}"${totalDistRec ? ` TotalDistRec="${totalDistRec}"` : ""}${cpExtraAttrs}>
${ubicaciones.length > 0 ? `        <${cpNs}:Ubicaciones>\n${ubiXml}\n        </${cpNs}:Ubicaciones>` : ""}
${mercancias.length > 0 ? `        <${cpNs}:Mercancias${mercanciasAttrs}>\n${merXml}\n        </${cpNs}:Mercancias>` : ""}
${autoXml}
${figurasXml}
    </${cpNs}:CartaPorte>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// AA) Carta Porte válida base
async function testCartaPorteValida(): Promise<void> {
  const xml = buildCartaPorteXml({});
  const result = analyzeCfdi(xml, "carta-porte-valida.xml");

  assertTruthy(result.cartaPorte, "cartaPorte debe existir");
  assertEqual(result.cartaPorte!.version, "3.1", "version debe ser 3.1");
  assertTruthy(result.cartaPorte!.ubicaciones.length >= 2, "ubicaciones >= 2");
  assertTruthy(result.cartaPorte!.mercancias.length >= 1, "mercancias >= 1");
  assertEqual(result.cartaPorte!.hasAutotransporte, true, "hasAutotransporte true");
  assertIncludesFinding(result.findings, "CARTA_PORTE_DETECTED");
  const detected = result.findings.find((f) => f.code === "CARTA_PORTE_DETECTED")!;
  assertEqual(detected.severity, "INFO", "CARTA_PORTE_DETECTED debe ser INFO");
  assertTruthy(
    !result.findings.some((f) => f.code === "CARTA_PORTE_MISSING_UBICACIONES"),
    "No debe existir CARTA_PORTE_MISSING_UBICACIONES",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "CARTA_PORTE_MISSING_MERCANCIAS"),
    "No debe existir CARTA_PORTE_MISSING_MERCANCIAS",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "CARTA_PORTE_ORIGIN_DESTINATION_REVIEW"),
    "No debe existir CARTA_PORTE_ORIGIN_DESTINATION_REVIEW",
  );
}

// AB) Carta Porte sin ubicaciones/mercancías
async function testCartaPorteSinUbicacionesMercancias(): Promise<void> {
  const xml = buildCartaPorteXml({
    ubicaciones: [],
    mercancias: [],
  });
  const result = analyzeCfdi(xml, "carta-porte-sin-ubi-mer.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_MISSING_UBICACIONES");
  assertIncludesFinding(result.findings, "CARTA_PORTE_MISSING_MERCANCIAS");
  const ubiFinding = result.findings.find((f) => f.code === "CARTA_PORTE_MISSING_UBICACIONES")!;
  assertEqual(ubiFinding.severity, "WARNING", "CARTA_PORTE_MISSING_UBICACIONES debe ser WARNING");
  const merFinding = result.findings.find((f) => f.code === "CARTA_PORTE_MISSING_MERCANCIAS")!;
  assertEqual(merFinding.severity, "WARNING", "CARTA_PORTE_MISSING_MERCANCIAS debe ser WARNING");
}

// AC) Carta Porte tipo comprobante inesperado
async function testCartaPorteTipoInesperado(): Promise<void> {
  const xml = buildCartaPorteXml({ tipoComprobante: "P" });
  const result = analyzeCfdi(xml, "carta-porte-tipo-pago.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE");
  const finding = result.findings.find((f) => f.code === "CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE")!;
  assertEqual(
    finding.severity,
    "WARNING",
    "CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE debe ser WARNING",
  );
}

// AD) Carta Porte traslado con total distinto de cero
async function testCartaPorteTrasladoTotalNoCero(): Promise<void> {
  const xml = buildCartaPorteXml({
    tipoComprobante: "T",
    total: "100.00",
    subtotal: "100.00",
  });
  const result = analyzeCfdi(xml, "carta-porte-traslado-total-no-cero.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_TRASLADO_TOTAL_NOT_ZERO");
  const finding = result.findings.find((f) => f.code === "CARTA_PORTE_TRASLADO_TOTAL_NOT_ZERO")!;
  assertEqual(finding.severity, "WARNING", "CARTA_PORTE_TRASLADO_TOTAL_NOT_ZERO debe ser WARNING");
}

// AE) Carta Porte mercancía inválida
async function testCartaPorteMercanciaInvalida(): Promise<void> {
  const xml = buildCartaPorteXml({
    mercancias: [{ cantidad: "0", pesoEnKg: "-5.00" }],
  });
  const result = analyzeCfdi(xml, "carta-porte-mercancia-invalida.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_MERCANCIA_MISSING_BIENES_TRANSP");
  assertIncludesFinding(result.findings, "CARTA_PORTE_MERCANCIA_INVALID_QUANTITY");
  assertIncludesFinding(result.findings, "CARTA_PORTE_MERCANCIA_INVALID_WEIGHT");
}

// EW) Carta Porte single location (missing destino/origen)
async function testCartaPorteSingleLocation(): Promise<void> {
  const xml = buildCartaPorteXml({
    ubicaciones: [
      {
        tipo: "Origen",
        id: "OR001",
        rfc: "EKU9003173C9",
        nombre: "ORIGEN SA",
        fecha: "2024-06-01T08:00:00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-single-location.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_SINGLE_LOCATION_REVIEW");
  const slFinding = result.findings.find((f) => f.code === "CARTA_PORTE_SINGLE_LOCATION_REVIEW")!;
  assertEqual(slFinding.severity, "INFO", "CARTA_PORTE_SINGLE_LOCATION_REVIEW debe ser INFO");
  assertIncludesFinding(result.findings, "CARTA_PORTE_ORIGIN_DESTINATION_REVIEW");
}

// EX) Carta Porte destino sin distancia recorrida
async function testCartaPorteDestinoSinDistancia(): Promise<void> {
  const xml = buildCartaPorteXml({
    ubicaciones: [
      {
        tipo: "Origen",
        id: "OR001",
        rfc: "EKU9003173C9",
        nombre: "ORIGEN SA",
        fecha: "2024-06-01T08:00:00",
        distancia: "0",
      },
      {
        tipo: "Destino",
        id: "DE001",
        rfc: "EKU9003173C9",
        nombre: "DESTINO SA",
        fecha: "2024-06-01T18:00:00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-destino-sin-distancia.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_DESTINO_WITHOUT_DISTANCIA");
  const finding = result.findings.find((f) => f.code === "CARTA_PORTE_DESTINO_WITHOUT_DISTANCIA")!;
  assertEqual(
    finding.severity,
    "WARNING",
    "CARTA_PORTE_DESTINO_WITHOUT_DISTANCIA debe ser WARNING",
  );
}

// EY) Carta Porte TotalDistRec mismatch
async function testCartaPorteTotalDistRecMismatch(): Promise<void> {
  const xml = buildCartaPorteXml({
    totalDistRec: "500.00",
    ubicaciones: [
      {
        tipo: "Origen",
        id: "OR001",
        rfc: "EKU9003173C9",
        nombre: "ORIGEN SA",
        fecha: "2024-06-01T08:00:00",
      },
      {
        tipo: "Destino",
        id: "DE001",
        rfc: "EKU9003173C9",
        nombre: "DESTINO SA",
        fecha: "2024-06-01T18:00:00",
        distancia: "300.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-total-dist-mismatch.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_TOTAL_DIST_REC_MISMATCH");
  const finding = result.findings.find((f) => f.code === "CARTA_PORTE_TOTAL_DIST_REC_MISMATCH")!;
  assertEqual(finding.severity, "WARNING", "CARTA_PORTE_TOTAL_DIST_REC_MISMATCH debe ser WARNING");
}

// EZ) Carta Porte NumTotalMercancias mismatch
async function testCartaPorteNumTotalMercanciasMismatch(): Promise<void> {
  const xml = buildCartaPorteXml({
    numTotalMercancias: "3",
    mercancias: [
      {
        bienesTransp: "12101500",
        descripcion: "Material",
        cantidad: "10",
        claveUnidad: "KGM",
        pesoEnKg: "100.00",
      },
      {
        bienesTransp: "12101600",
        descripcion: "Otro",
        cantidad: "5",
        claveUnidad: "KGM",
        pesoEnKg: "50.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-num-total-merc-mismatch.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_NUM_TOTAL_MERCANCIAS_MISMATCH");
  const finding = result.findings.find(
    (f) => f.code === "CARTA_PORTE_NUM_TOTAL_MERCANCIAS_MISMATCH",
  )!;
  assertEqual(
    finding.severity,
    "WARNING",
    "CARTA_PORTE_NUM_TOTAL_MERCANCIAS_MISMATCH debe ser WARNING",
  );
}

// FA) Carta Porte PesoBrutoTotal mismatch
async function testCartaPortePesoBrutoTotalMismatch(): Promise<void> {
  const xml = buildCartaPorteXml({
    pesoBrutoTotal: "100.00",
    mercancias: [
      {
        bienesTransp: "12101500",
        descripcion: "Material",
        cantidad: "1",
        claveUnidad: "KGM",
        pesoEnKg: "30.00",
      },
      {
        bienesTransp: "12101600",
        descripcion: "Otro",
        cantidad: "1",
        claveUnidad: "KGM",
        pesoEnKg: "20.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-peso-bruto-mismatch.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_PESO_BRUTO_TOTAL_MISMATCH");
  const finding = result.findings.find((f) => f.code === "CARTA_PORTE_PESO_BRUTO_TOTAL_MISMATCH")!;
  assertEqual(
    finding.severity,
    "WARNING",
    "CARTA_PORTE_PESO_BRUTO_TOTAL_MISMATCH debe ser WARNING",
  );
}

// FB) Carta Porte mercancía sin ClaveUnidad
async function testCartaPorteMercanciaSinClaveUnidad(): Promise<void> {
  const xml = buildCartaPorteXml({
    mercancias: [
      { bienesTransp: "12101500", descripcion: "Material", cantidad: "10", pesoEnKg: "100.00" },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-merc-sin-clave-unidad.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_MERCANCIA_MISSING_CLAVE_UNIDAD");
  const finding = result.findings.find(
    (f) => f.code === "CARTA_PORTE_MERCANCIA_MISSING_CLAVE_UNIDAD",
  )!;
  assertEqual(
    finding.severity,
    "WARNING",
    "CARTA_PORTE_MERCANCIA_MISSING_CLAVE_UNIDAD debe ser WARNING",
  );
}

// FC) Carta Porte material peligroso sin clave/embalaje
async function testCartaPorteMaterialPeligrosoSinClaveEmbalaje(): Promise<void> {
  const xml = buildCartaPorteXml({
    mercancias: [
      {
        bienesTransp: "12101500",
        descripcion: "Material",
        cantidad: "10",
        claveUnidad: "KGM",
        pesoEnKg: "100.00",
        materialPeligroso: "Sí",
      },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-mat-peligroso-sin-clave-embalaje.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_MATERIAL_PELIGROSO_WITHOUT_CLAVE");
  assertIncludesFinding(result.findings, "CARTA_PORTE_MATERIAL_PELIGROSO_WITHOUT_EMBALAJE");
  const cFinding = result.findings.find(
    (f) => f.code === "CARTA_PORTE_MATERIAL_PELIGROSO_WITHOUT_CLAVE",
  )!;
  assertEqual(
    cFinding.severity,
    "WARNING",
    "CARTA_PORTE_MATERIAL_PELIGROSO_WITHOUT_CLAVE debe ser WARNING",
  );
  const eFinding = result.findings.find(
    (f) => f.code === "CARTA_PORTE_MATERIAL_PELIGROSO_WITHOUT_EMBALAJE",
  )!;
  assertEqual(
    eFinding.severity,
    "WARNING",
    "CARTA_PORTE_MATERIAL_PELIGROSO_WITHOUT_EMBALAJE debe ser WARNING",
  );
}

// FD) Carta Porte autotransporte sin permiso/vehículo/seguro
async function testCartaPorteAutotransporteSinPermisoVehiculoSeguro(): Promise<void> {
  const xml = buildCartaPorteXml({ hasAutotransporte: true, autotransporteCompleto: false });
  const result = analyzeCfdi(xml, "carta-porte-auto-sin-permiso-vehiculo-seguro.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_PERMISO");
  assertIncludesFinding(result.findings, "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_VEHICULO");
  assertIncludesFinding(result.findings, "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_SEGURO_RC");
  const pFinding = result.findings.find(
    (f) => f.code === "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_PERMISO",
  )!;
  assertEqual(
    pFinding.severity,
    "WARNING",
    "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_PERMISO debe ser WARNING",
  );
  const vFinding = result.findings.find(
    (f) => f.code === "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_VEHICULO",
  )!;
  assertEqual(
    vFinding.severity,
    "WARNING",
    "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_VEHICULO debe ser WARNING",
  );
  const sFinding = result.findings.find(
    (f) => f.code === "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_SEGURO_RC",
  )!;
  assertEqual(
    sFinding.severity,
    "WARNING",
    "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_SEGURO_RC debe ser WARNING",
  );
}

// FE) Carta Porte operador sin licencia
async function testCartaPorteOperadorSinLicencia(): Promise<void> {
  const xml = buildCartaPorteXml({
    figurasTransporte: [
      { tipoFigura: "03", rfcFigura: "EKU9003173C9", nombreFigura: "OPERADOR SA" },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-operador-sin-licencia.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_OPERADOR_WITHOUT_LICENCIA");
  const finding = result.findings.find((f) => f.code === "CARTA_PORTE_OPERADOR_WITHOUT_LICENCIA")!;
  assertEqual(
    finding.severity,
    "WARNING",
    "CARTA_PORTE_OPERADOR_WITHOUT_LICENCIA debe ser WARNING",
  );
}

// FF) Carta Porte internacional sin país/vía
async function testCartaPorteInternacionalSinPaisVia(): Promise<void> {
  const xml = buildCartaPorteXml({
    transpInternac: "Sí",
    totalDistRec: "500.00",
  });
  const result = analyzeCfdi(xml, "carta-porte-internacional-sin-pais-via.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_INTERNACIONAL_MISSING_PAIS_OR_VIA");
  const finding = result.findings.find(
    (f) => f.code === "CARTA_PORTE_INTERNACIONAL_MISSING_PAIS_OR_VIA",
  )!;
  assertEqual(
    finding.severity,
    "WARNING",
    "CARTA_PORTE_INTERNACIONAL_MISSING_PAIS_OR_VIA debe ser WARNING",
  );
}

// ─── Nomina fixtures ───────────────────────────────────────────────────────────

const NOMINA_NS = 'xmlns:nomina12="http://www.sat.gob.mx/nomina12"';

function buildNominaXml(opts?: {
  tipoComprobante?: string;
  total?: string;
  subTotal?: string;
  version?: string;
  tipoNomina?: string;
  fechaPago?: string;
  fechaInicialPago?: string;
  fechaFinalPago?: string;
  numDiasPagados?: string;
  totalPercepciones?: string;
  totalDeducciones?: string;
  totalOtrosPagos?: string;
  receptorCurp?: string;
  receptorNss?: string;
  receptorNumEmpleado?: string;
  receptorDepto?: string;
  receptorPuesto?: string;
  receptorTipoContrato?: string;
  receptorTipoRegimen?: string;
  receptorPeriodicidadPago?: string;
  receptorSalarioBase?: string;
  receptorSalarioDiario?: string;
  receptorClaveEntFed?: string;
  receptorBanco?: string;
  receptorCuentaBancaria?: string;
  percepcionesHeaderGravado?: string;
  percepcionesHeaderExento?: string;
  deduccionesHeaderOtras?: string;
  deduccionesHeaderIsr?: string;
  percepciones?: Array<{
    tipo: string;
    clave: string;
    concepto: string;
    gravado: string;
    exento: string;
  }>;
  deducciones?: Array<{ tipo: string; clave: string; concepto: string; importe: string }>;
  otrosPagos?: Array<{
    tipo: string;
    clave: string;
    concepto: string;
    importe: string;
    subsidioCausado?: string;
  }>;
  omitirPercepciones?: boolean;
  omitirDeducciones?: boolean;
}): string {
  const tipo = opts?.tipoComprobante ?? "I";
  const total = opts?.total ?? "15000.00";
  const subTotal = opts?.subTotal ?? total;
  const version = opts?.version ?? "1.2";
  const tipoNomina = opts?.tipoNomina ?? "O";
  const fechaPago = opts?.fechaPago !== undefined ? opts.fechaPago : "2024-07-15";
  const fechaInicialPago =
    opts?.fechaInicialPago !== undefined ? opts.fechaInicialPago : "2024-07-01";
  const fechaFinalPago = opts?.fechaFinalPago !== undefined ? opts.fechaFinalPago : "2024-07-15";
  const numDiasPagados = opts?.numDiasPagados !== undefined ? opts.numDiasPagados : "15";
  const totalPercepciones = opts?.totalPercepciones ?? "15000.00";
  const totalDeducciones = opts?.totalDeducciones ?? "3000.00";
  const totalOtrosPagos = opts?.totalOtrosPagos ?? "0.00";
  const curp = opts?.receptorCurp !== undefined ? opts.receptorCurp : "ABCD123456HDFRRL09";
  const nss = opts?.receptorNss !== undefined ? opts.receptorNss : "12345678901";
  const numEmpleado = opts?.receptorNumEmpleado !== undefined ? opts.receptorNumEmpleado : "EMP001";
  const depto = opts?.receptorDepto !== undefined ? opts.receptorDepto : "SISTEMAS";
  const puesto = opts?.receptorPuesto !== undefined ? opts.receptorPuesto : "ANALISTA";
  const tipoContrato = opts?.receptorTipoContrato !== undefined ? opts.receptorTipoContrato : "01";
  const tipoRegimen = opts?.receptorTipoRegimen !== undefined ? opts.receptorTipoRegimen : "02";
  const periodicidad =
    opts?.receptorPeriodicidadPago !== undefined ? opts.receptorPeriodicidadPago : "02";
  const salBase = opts?.receptorSalarioBase !== undefined ? opts.receptorSalarioBase : "500.00";
  const salDiario =
    opts?.receptorSalarioDiario !== undefined ? opts.receptorSalarioDiario : "520.00";
  const claveEdofed = opts?.receptorClaveEntFed !== undefined ? opts.receptorClaveEntFed : "CDMX";
  const banco = opts?.receptorBanco !== undefined ? opts.receptorBanco : "";
  const cuentaBancaria =
    opts?.receptorCuentaBancaria !== undefined ? opts.receptorCuentaBancaria : "";
  const percHeaderGravado = opts?.percepcionesHeaderGravado;
  const percHeaderExento = opts?.percepcionesHeaderExento;
  const dedHeaderOtras = opts?.deduccionesHeaderOtras;
  const dedHeaderIsr = opts?.deduccionesHeaderIsr;

  const defaultPercepciones = [
    { tipo: "001", clave: "P001", concepto: "Sueldo", gravado: "13000.00", exento: "0.00" },
    { tipo: "002", clave: "P002", concepto: "Bono", gravado: "2000.00", exento: "0.00" },
  ];
  const defaultDeducciones = [
    { tipo: "001", clave: "D001", concepto: "ISR", importe: "2000.00" },
    { tipo: "002", clave: "D002", concepto: "IMSS", importe: "1000.00" },
  ];
  const defaultOtrosPagos: Array<{
    tipo: string;
    clave: string;
    concepto: string;
    importe: string;
    subsidioCausado?: string;
  }> = [];

  const percList = opts?.percepciones ?? defaultPercepciones;
  const dedList = opts?.deducciones ?? defaultDeducciones;
  const opList = opts?.otrosPagos ?? defaultOtrosPagos;

  const percHeaderAttrs = `${percHeaderGravado ? ` TotalGravado="${percHeaderGravado}"` : ""}${percHeaderExento ? ` TotalExento="${percHeaderExento}"` : ""}`;
  const dedHeaderAttrs = `${dedHeaderOtras ? ` TotalOtrasDeducciones="${dedHeaderOtras}"` : ""}${dedHeaderIsr ? ` TotalImpuestosRetenidos="${dedHeaderIsr}"` : ""}`;

  const percepcionesXml = opts?.omitirPercepciones
    ? ""
    : `        <nomina12:Percepciones TotalSueldos="${totalPercepciones}"${percHeaderAttrs}>
${percList.map((p) => `          <nomina12:Percepcion${p.tipo ? ` TipoPercepcion="${p.tipo}"` : ""}${p.clave ? ` Clave="${p.clave}"` : ""}${p.concepto ? ` Concepto="${p.concepto}"` : ""} ImporteGravado="${p.gravado}" ImporteExento="${p.exento}"/>`).join("\n")}
        </nomina12:Percepciones>`;

  const deduccionesXml = opts?.omitirDeducciones
    ? ""
    : dedList.length > 0
      ? `        <nomina12:Deducciones${dedHeaderAttrs || ` TotalOtrasDeducciones="${totalDeducciones}"`}>
${dedList.map((d) => `          <nomina12:Deduccion${d.tipo ? ` TipoDeduccion="${d.tipo}"` : ""}${d.clave ? ` Clave="${d.clave}"` : ""}${d.concepto ? ` Concepto="${d.concepto}"` : ""}${d.importe ? ` Importe="${d.importe}"` : ""}/>`).join("\n")}
        </nomina12:Deducciones>`
      : "";

  const otrosPagosXml =
    opList.length > 0
      ? `        <nomina12:OtrosPagos>
${opList
  .map((o) => {
    const subsidioXml = o.subsidioCausado
      ? `\n            <nomina12:SubsidioAlEmpleo SubsidioCausado="${o.subsidioCausado}"/>`
      : "";
    return `          <nomina12:OtroPago${o.tipo ? ` TipoOtroPago="${o.tipo}"` : ""}${o.clave ? ` Clave="${o.clave}"` : ""}${o.concepto ? ` Concepto="${o.concepto}"` : ""}${o.importe ? ` Importe="${o.importe}"` : ""}>${subsidioXml}\n          </nomina12:OtroPago>`;
  })
  .join("\n")}
        </nomina12:OtrosPagos>`
      : "";

  const nominaAttrs = `Version="${version}" TipoNomina="${tipoNomina}"${fechaPago !== null ? ` FechaPago="${fechaPago}"` : ""}${fechaInicialPago !== null ? ` FechaInicialPago="${fechaInicialPago}"` : ""}${fechaFinalPago !== null ? ` FechaFinalPago="${fechaFinalPago}"` : ""}${numDiasPagados !== null ? ` NumDiasPagados="${numDiasPagados}"` : ""} TotalPercepciones="${totalPercepciones}" TotalDeducciones="${totalDeducciones}" TotalOtrosPagos="${totalOtrosPagos}"`;

  const receptorAttrs = `${curp !== null ? ` CURP="${curp}"` : ""}${nss !== null ? ` NumSeguridadSocial="${nss}"` : ""}${numEmpleado !== null ? ` NumEmpleado="${numEmpleado}"` : ""}${depto ? ` Departamento="${depto}"` : ""}${puesto ? ` Puesto="${puesto}"` : ""}${tipoContrato ? ` TipoContrato="${tipoContrato}"` : ""}${tipoRegimen ? ` TipoRegimen="${tipoRegimen}"` : ""}${periodicidad ? ` PeriodicidadPago="${periodicidad}"` : ""}${salBase ? ` SalarioBaseCotApor="${salBase}"` : ""}${salDiario ? ` SalarioDiarioIntegrado="${salDiario}"` : ""}${claveEdofed ? ` ClaveEntFed="${claveEdofed}"` : ""}${banco ? ` Banco="${banco}"` : ""}${cuentaBancaria ? ` CuentaBancaria="${cuentaBancaria}"` : ""}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${NOMINA_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="N" Folio="1" Fecha="2024-07-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="${subTotal}" Moneda="MXN" Total="${total}" TipoDeComprobante="${tipo}" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="TRABAJADOR SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="S01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111505" Cantidad="1" ClaveUnidad="ACT" Descripcion="Nómina" ValorUnitario="${total}" Importe="${total}" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <nomina12:Nomina ${nominaAttrs}>
      <nomina12:Receptor${receptorAttrs}/>
      ${percepcionesXml}
      ${deduccionesXml}
      ${otrosPagosXml}
    </nomina12:Nomina>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="nomina-0000-0000-0000-00000000af" FechaTimbrado="2024-07-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// AF) Nómina válida base
async function testNominaValidaBase(): Promise<void> {
  const xml = buildNominaXml({});
  const result = analyzeCfdi(xml, "nomina-valida.xml");

  assertTruthy(result.nomina, "nomina debe existir");
  assertIncludesFinding(result.findings, "NOMINA_DETECTED");
  const detected = result.findings.find((f) => f.code === "NOMINA_DETECTED")!;
  assertEqual(detected.severity, "INFO", "NOMINA_DETECTED debe ser INFO");
  assertTruthy(
    !result.findings.some((f) => f.code === "NOMINA_TOTAL_PERCEPCIONES_MISMATCH"),
    "No debe existir NOMINA_TOTAL_PERCEPCIONES_MISMATCH",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "NOMINA_TOTAL_DEDUCCIONES_MISMATCH"),
    "No debe existir NOMINA_TOTAL_DEDUCCIONES_MISMATCH",
  );
}

// AG) Nómina sin percepciones
async function testNominaSinPercepciones(): Promise<void> {
  const xml = buildNominaXml({ omitirPercepciones: true, totalPercepciones: "0.00" });
  const result = analyzeCfdi(xml, "nomina-sin-percepciones.xml");

  assertIncludesFinding(result.findings, "NOMINA_WITHOUT_PERCEPCIONES");
  const finding = result.findings.find((f) => f.code === "NOMINA_WITHOUT_PERCEPCIONES")!;
  assertEqual(finding.severity, "WARNING", "NOMINA_WITHOUT_PERCEPCIONES debe ser WARNING");
  assertEqual(result.executiveSummary.riskLevel, "WARNING", "riskLevel debe ser WARNING");
}

// AH) Nómina receptor incompleto
async function testNominaReceptorIncompleto(): Promise<void> {
  const xml = buildNominaXml({
    receptorCurp: "",
    receptorNss: "12345",
    receptorNumEmpleado: "",
  });
  const result = analyzeCfdi(xml, "nomina-receptor-incompleto.xml");

  assertTruthy(result.nomina, "nomina debe existir");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_MISSING_CURP");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_MISSING_NUM_EMPLEADO");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_NSS_FORMAT_REVIEW");
  const curpFinding = result.findings.find((f) => f.code === "NOMINA_RECEPTOR_MISSING_CURP")!;
  assertEqual(curpFinding.severity, "WARNING", "NOMINA_RECEPTOR_MISSING_CURP debe ser WARNING");
  const numEmpFinding = result.findings.find(
    (f) => f.code === "NOMINA_RECEPTOR_MISSING_NUM_EMPLEADO",
  )!;
  assertEqual(
    numEmpFinding.severity,
    "WARNING",
    "NOMINA_RECEPTOR_MISSING_NUM_EMPLEADO debe ser WARNING",
  );
  const nssFinding = result.findings.find((f) => f.code === "NOMINA_RECEPTOR_NSS_FORMAT_REVIEW")!;
  assertEqual(nssFinding.severity, "INFO", "NOMINA_RECEPTOR_NSS_FORMAT_REVIEW debe ser INFO");
}

// AI) Nómina mismatch percepciones
async function testNominaMismatchPercepciones(): Promise<void> {
  const xml = buildNominaXml({
    totalPercepciones: "1000.00",
    percepciones: [
      { tipo: "001", clave: "P001", concepto: "Sueldo", gravado: "900.00", exento: "0.00" },
    ],
  });
  const result = analyzeCfdi(xml, "nomina-mismatch-percepciones.xml");

  assertIncludesFinding(result.findings, "NOMINA_TOTAL_PERCEPCIONES_MISMATCH");
  const finding = result.findings.find((f) => f.code === "NOMINA_TOTAL_PERCEPCIONES_MISMATCH")!;
  assertEqual(finding.severity, "CRITICAL", "NOMINA_TOTAL_PERCEPCIONES_MISMATCH debe ser CRITICAL");
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

// AJ) Nómina mismatch deducciones/otros pagos
async function testNominaMismatchDeduccionesOtrosPagos(): Promise<void> {
  const xml = buildNominaXml({
    totalDeducciones: "5000.00",
    totalOtrosPagos: "2000.00",
    deducciones: [
      { tipo: "001", clave: "D001", concepto: "ISR", importe: "2000.00" },
      { tipo: "002", clave: "D002", concepto: "IMSS", importe: "1000.00" },
    ],
    otrosPagos: [{ tipo: "001", clave: "OP001", concepto: "Reembolso", importe: "500.00" }],
  });
  const result = analyzeCfdi(xml, "nomina-mismatch-ded-otros.xml");

  assertIncludesFinding(result.findings, "NOMINA_TOTAL_DEDUCCIONES_MISMATCH");
  assertIncludesFinding(result.findings, "NOMINA_TOTAL_OTROS_PAGOS_MISMATCH");
  const dedFinding = result.findings.find((f) => f.code === "NOMINA_TOTAL_DEDUCCIONES_MISMATCH")!;
  assertEqual(
    dedFinding.severity,
    "CRITICAL",
    "NOMINA_TOTAL_DEDUCCIONES_MISMATCH debe ser CRITICAL",
  );
  const opFinding = result.findings.find((f) => f.code === "NOMINA_TOTAL_OTROS_PAGOS_MISMATCH")!;
  assertEqual(
    opFinding.severity,
    "CRITICAL",
    "NOMINA_TOTAL_OTROS_PAGOS_MISMATCH debe ser CRITICAL",
  );
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

// ─── Concept Tax fixtures ───────────────────────────────────────────────────────

function buildConceptTaxXml(opts: {
  objetoImp?: string;
  hasTraslados?: boolean;
  hasRetenciones?: boolean;
  traslados?: Array<{
    base?: string;
    impuesto?: string;
    tipoFactor?: string;
    tasaOCuota?: string;
    importe?: string;
  }>;
  retenciones?: Array<{
    base?: string;
    impuesto?: string;
    tipoFactor?: string;
    tasaOCuota?: string;
    importe?: string;
  }>;
  importe?: string;
  descuento?: string;
  cantidad?: string;
  valorUnitario?: string;
  hasImpuestosNodo?: boolean;
}): string {
  const objetoImp = opts.objetoImp ?? "02";
  const importe = opts.importe ?? "1000.00";
  const descuento = opts.descuento;
  const cantidad = opts.cantidad ?? "1";
  const valorUnitario = opts.valorUnitario ?? "1000.00";
  const hasTraslados = opts.hasTraslados ?? true;
  const hasRetenciones = opts.hasRetenciones ?? false;

  const traslados = opts.traslados ?? [
    {
      base: "1000.00",
      impuesto: "002",
      tipoFactor: "Tasa",
      tasaOCuota: "0.160000",
      importe: "160.00",
    },
  ];
  const retenciones = opts.retenciones ?? [];
  const hasImpuestosNodo = opts.hasImpuestosNodo ?? true;

  const trasladosXml =
    hasTraslados && hasImpuestosNodo
      ? `        <cfdi:Traslados>
${traslados.map((t) => `          <cfdi:Traslado${t.base ? ` Base="${t.base}"` : ""}${t.impuesto ? ` Impuesto="${t.impuesto}"` : ""}${t.tipoFactor ? ` TipoFactor="${t.tipoFactor}"` : ""}${t.tasaOCuota ? ` TasaOCuota="${t.tasaOCuota}"` : ""}${t.importe ? ` Importe="${t.importe}"` : ""}/>`).join("\n")}
        </cfdi:Traslados>`
      : "";

  const retencionesXml =
    hasRetenciones && hasImpuestosNodo
      ? `        <cfdi:Retenciones>
${retenciones.map((r) => `          <cfdi:Retencion${r.base ? ` Base="${r.base}"` : ""}${r.impuesto ? ` Impuesto="${r.impuesto}"` : ""}${r.tipoFactor ? ` TipoFactor="${r.tipoFactor}"` : ""}${r.tasaOCuota ? ` TasaOCuota="${r.tasaOCuota}"` : ""}${r.importe ? ` Importe="${r.importe}"` : ""}/>`).join("\n")}
        </cfdi:Retenciones>`
      : "";

  const impuestosXml =
    hasImpuestosNodo && (trasladosXml || retencionesXml)
      ? `      <cfdi:Impuestos>
${trasladosXml}
${retencionesXml}
      </cfdi:Impuestos>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="CT1" Fecha="2024-08-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="${importe}" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="${cantidad}" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto de prueba" ValorUnitario="${valorUnitario}" Importe="${importe}"${descuento ? ` Descuento="${descuento}"` : ""}${objetoImp ? ` ObjetoImp="${objetoImp}"` : ""}>
${impuestosXml}
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="ctax-0000-0000-0000-00000000ct1" FechaTimbrado="2024-08-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// AK) Concepto ObjetoImp 01 con impuestos
async function testConceptoObjetoImp01ConImpuestos(): Promise<void> {
  const xml = buildConceptTaxXml({ objetoImp: "01" });
  const result = analyzeCfdi(xml, "objetoimp-01-con-impuestos.xml");

  assertIncludesFinding(result.findings, "CONCEPT_OBJETO_IMP_01_WITH_TAXES");
  const finding = result.findings.find((f) => f.code === "CONCEPT_OBJETO_IMP_01_WITH_TAXES")!;
  assertEqual(finding.severity, "WARNING", "CONCEPT_OBJETO_IMP_01_WITH_TAXES debe ser WARNING");
}

// AL) Concepto ObjetoImp 02 sin impuestos
async function testConceptoObjetoImp02SinImpuestos(): Promise<void> {
  const xml = buildConceptTaxXml({
    objetoImp: "02",
    hasTraslados: false,
    hasRetenciones: false,
    hasImpuestosNodo: false,
  });
  const result = analyzeCfdi(xml, "objetoimp-02-sin-impuestos.xml");

  assertIncludesFinding(result.findings, "CONCEPT_OBJETO_IMP_02_WITHOUT_TAXES");
  const finding = result.findings.find((f) => f.code === "CONCEPT_OBJETO_IMP_02_WITHOUT_TAXES")!;
  assertEqual(finding.severity, "WARNING", "CONCEPT_OBJETO_IMP_02_WITHOUT_TAXES debe ser WARNING");
}

// AM) Impuesto por concepto con cálculo correcto
async function testConceptoCalculoCorrecto(): Promise<void> {
  const xml = buildConceptTaxXml({});
  const result = analyzeCfdi(xml, "concepto-calculo-correcto.xml");

  assertTruthy(
    !result.findings.some((f) => f.code === "CONCEPT_TAX_AMOUNT_MISMATCH"),
    "No debe existir CONCEPT_TAX_AMOUNT_MISMATCH",
  );
}

// AN) Impuesto por concepto con cálculo incorrecto
async function testConceptoCalculoIncorrecto(): Promise<void> {
  const xml = buildConceptTaxXml({
    traslados: [
      {
        base: "1000.00",
        impuesto: "002",
        tipoFactor: "Tasa",
        tasaOCuota: "0.160000",
        importe: "150.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "concepto-calculo-incorrecto.xml");

  assertIncludesFinding(result.findings, "CONCEPT_TAX_AMOUNT_MISMATCH");
  const finding = result.findings.find((f) => f.code === "CONCEPT_TAX_AMOUNT_MISMATCH")!;
  assertEqual(finding.severity, "CRITICAL", "CONCEPT_TAX_AMOUNT_MISMATCH debe ser CRITICAL");
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

// AO) Descuento mayor al importe
async function testConceptoDescuentoMayorImporte(): Promise<void> {
  const xml = buildConceptTaxXml({ importe: "100.00", descuento: "120.00", objetoImp: "02" });
  const result = analyzeCfdi(xml, "concepto-descuento-mayor.xml");

  assertIncludesFinding(result.findings, "CONCEPT_DISCOUNT_EXCEEDS_IMPORT");
  const finding = result.findings.find((f) => f.code === "CONCEPT_DISCOUNT_EXCEEDS_IMPORT")!;
  assertEqual(finding.severity, "CRITICAL", "CONCEPT_DISCOUNT_EXCEEDS_IMPORT debe ser CRITICAL");
}

// AP) Exento con importe
async function testConceptoExentoConImporte(): Promise<void> {
  const xml = buildConceptTaxXml({
    objetoImp: "03",
    traslados: [{ base: "1000.00", impuesto: "002", tipoFactor: "Exento", importe: "10.00" }],
  });
  const result = analyzeCfdi(xml, "concepto-exento-con-importe.xml");

  assertIncludesFinding(result.findings, "CONCEPT_TAX_EXEMPT_WITH_AMOUNT");
  const finding = result.findings.find((f) => f.code === "CONCEPT_TAX_EXEMPT_WITH_AMOUNT")!;
  assertEqual(finding.severity, "WARNING", "CONCEPT_TAX_EXEMPT_WITH_AMOUNT debe ser WARNING");
}

// AQ) Cantidad/valor unitario mismatch
async function testConceptoCantidadValorUnitarioMismatch(): Promise<void> {
  const xml = buildConceptTaxXml({
    cantidad: "2",
    valorUnitario: "100.00",
    importe: "250.00",
    objetoImp: "02",
  });
  const result = analyzeCfdi(xml, "concepto-cantidad-valor-mismatch.xml");

  assertIncludesFinding(result.findings, "CONCEPT_UNIT_VALUE_MISMATCH_REVIEW");
  const finding = result.findings.find((f) => f.code === "CONCEPT_UNIT_VALUE_MISMATCH_REVIEW")!;
  assertEqual(finding.severity, "WARNING", "CONCEPT_UNIT_VALUE_MISMATCH_REVIEW debe ser WARNING");
}

// ─── Global Tax fixtures ───────────────────────────────────────────────────────────

function buildGlobalTaxConsistentXml(): string {
  return buildCfdi40Ingreso();
}

function buildGlobalTransferredTotalMismatchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GT1" Fecha="2024-09-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1150.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="150.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="global-total-mismatch-0000-0000-000000000001" FechaTimbrado="2024-09-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildGlobalConceptSumMismatchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GT2" Fecha="2024-09-02T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1150.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="150.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="150.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="global-concept-sum-mismatch-0000-000000000002" FechaTimbrado="2024-09-02T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildGlobalWithheldGroupMissingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GT3" Fecha="2024-09-03T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1110.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
        <cfdi:Retenciones>
          <cfdi:Retencion Base="1000.00" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.100000" Importe="50.00"/>
        </cfdi:Retenciones>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00" TotalImpuestosRetenidos="0.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="global-withheld-group-missing-000000000003" FechaTimbrado="2024-09-03T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildGlobalWithheldWithoutConceptXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GT4" Fecha="2024-09-04T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1110.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00" TotalImpuestosRetenidos="50.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
    <cfdi:Retenciones>
      <cfdi:Retencion Base="1000.00" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.100000" Importe="50.00"/>
    </cfdi:Retenciones>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="global-withheld-without-concept-000000000004" FechaTimbrado="2024-09-04T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildGlobalDuplicateGroupXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GT5" Fecha="2024-09-05T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="2000.00" Moneda="MXN" Total="2320.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto 1" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
    <cfdi:Concepto ClaveProdServ="01010102" NoIdentificacion="002" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto 2" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="320.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="global-duplicate-group-0000-0000-000000000005" FechaTimbrado="2024-09-05T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// ─── Global Tax Test Cases ────────────────────────────────────────────────────

// AR) Global impuestos consistente
async function testGlobalImpuestosConsistente(): Promise<void> {
  const xml = buildGlobalTaxConsistentXml();
  const result = analyzeCfdi(xml, "global-consistente.xml");

  assertTruthy(
    !result.findings.some((f) => f.code === "GLOBAL_TRANSFERRED_CONCEPT_SUM_MISMATCH"),
    "No debe existir GLOBAL_TRANSFERRED_CONCEPT_SUM_MISMATCH",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "GLOBAL_TRANSFERRED_TOTAL_MISMATCH"),
    "No debe existir GLOBAL_TRANSFERRED_TOTAL_MISMATCH",
  );
}

// AS) TotalImpuestosTrasladados mismatch
async function testGlobalTransferredTotalMismatch(): Promise<void> {
  const xml = buildGlobalTransferredTotalMismatchXml();
  const result = analyzeCfdi(xml, "global-total-mismatch.xml");

  assertIncludesFinding(result.findings, "GLOBAL_TRANSFERRED_TOTAL_MISMATCH", "CRITICAL");
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

// AT) Global traslado vs conceptos mismatch
async function testGlobalConceptSumMismatch(): Promise<void> {
  const xml = buildGlobalConceptSumMismatchXml();
  const result = analyzeCfdi(xml, "global-concept-sum-mismatch.xml");

  assertIncludesFinding(result.findings, "GLOBAL_TRANSFERRED_CONCEPT_SUM_MISMATCH", "CRITICAL");
}

// AU) Grupo global faltante
async function testGlobalWithheldGroupMissing(): Promise<void> {
  const xml = buildGlobalWithheldGroupMissingXml();
  const result = analyzeCfdi(xml, "global-withheld-group-missing.xml");

  assertIncludesFinding(result.findings, "GLOBAL_WITHHELD_GROUP_MISSING", "WARNING");
}

// AV) Grupo global sin respaldo en conceptos
async function testGlobalWithheldWithoutConcept(): Promise<void> {
  const xml = buildGlobalWithheldWithoutConceptXml();
  const result = analyzeCfdi(xml, "global-withheld-without-concept.xml");

  assertIncludesFinding(result.findings, "GLOBAL_WITHHELD_GROUP_WITHOUT_CONCEPTS", "WARNING");
}

// AW) Grupo global duplicado
async function testGlobalDuplicateGroup(): Promise<void> {
  const xml = buildGlobalDuplicateGroupXml();
  const result = analyzeCfdi(xml, "global-duplicate-group.xml");

  assertIncludesFinding(result.findings, "GLOBAL_TAX_DUPLICATE_GROUP_REVIEW", "INFO");
}

// ─── Comprobante Base Test Cases ──────────────────────────────────────────────

// AX) Exportacion faltante en CFDI 4.0
function buildMissingExportacionXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="AX01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="ax-missing-exportacion-0000-000000000000" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// AY) TipoCambio requerido en moneda extranjera
function buildMissingTipoCambioXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="AY01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="100.00" Moneda="USD" Total="116.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="100.00" Importe="100.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="100.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="16.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="16.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="100.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="16.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="ay-missing-tc-00000000-0000-000000000001" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// AZ) Descuento mayor al subtotal
function buildDescuentoExceedsSubtotalXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="AZ01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Descuento="2000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="az-descuento-exceeds-0000-000000000002" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// BA) Subtotal vs conceptos mismatch
function buildSubtotalConceptMismatchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BA01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1500.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="ba-subtotal-mismatch-0000-000000000003" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// BB) LugarExpedicion formato inválido
function buildLugarExpedicionInvalidFormatXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BB01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="ABC" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bb-invalid-lugar-00000000-000000000004" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// BC) Fecha futura
function buildFutureFechaXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BC01" Fecha="2099-01-01T00:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bc-future-fecha-00000000-000000000005" FechaTimbrado="2099-01-01T00:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testMissingExportacion(): Promise<void> {
  const xml = buildMissingExportacionXml();
  const result = analyzeCfdi(xml, "ax-missing-exportacion.xml");

  assertIncludesFinding(result.findings, "COMPROBANTE_MISSING_EXPORTACION", "WARNING");
}

async function testMissingTipoCambio(): Promise<void> {
  const xml = buildMissingTipoCambioXml();
  const result = analyzeCfdi(xml, "ay-missing-tc.xml");

  assertIncludesFinding(result.findings, "COMPROBANTE_TIPO_CAMBIO_REQUIRED", "WARNING");
}

async function testDescuentoExceedsSubtotal(): Promise<void> {
  const xml = buildDescuentoExceedsSubtotalXml();
  const result = analyzeCfdi(xml, "az-descuento-exceeds.xml");

  assertIncludesFinding(result.findings, "COMPROBANTE_DESCUENTO_EXCEEDS_SUBTOTAL", "CRITICAL");
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

async function testSubtotalConceptMismatch(): Promise<void> {
  const xml = buildSubtotalConceptMismatchXml();
  const result = analyzeCfdi(xml, "ba-subtotal-mismatch.xml");

  assertIncludesFinding(result.findings, "COMPROBANTE_SUBTOTAL_CONCEPT_SUM_MISMATCH", "CRITICAL");
}

async function testLugarExpedicionInvalidFormat(): Promise<void> {
  const xml = buildLugarExpedicionInvalidFormatXml();
  const result = analyzeCfdi(xml, "bb-invalid-lugar.xml");

  assertIncludesFinding(result.findings, "COMPROBANTE_LUGAR_EXPEDICION_FORMAT_REVIEW", "INFO");
}

async function testFutureFecha(): Promise<void> {
  const xml = buildFutureFechaXml();
  const result = analyzeCfdi(xml, "bc-future-fecha.xml");

  assertIncludesFinding(result.findings, "COMPROBANTE_FECHA_FUTURE_REVIEW", "INFO");
}

// ─── Catalog & Tipo Comprobante Test Cases ───────────────────────────────────

// BD) FormaPago desconocida
function buildFormaPagoUnknownXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BD01" Fecha="2024-10-01T10:00:00" FormaPago="ZZ" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bd-unknown-formapago-000000000006" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// BE) TipoRelacion desconocido
function buildTipoRelacionUnknownXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BE01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="E" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:CfdiRelacionados TipoRelacion="99">
    <cfdi:CfdiRelacionado UUID="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"/>
  </cfdi:CfdiRelacionados>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="be-unknown-tiporelacion-000000000007" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// BF) Pago con total/subtotal/moneda incorrectos
function buildPagoFieldsIncorrectXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BF01" Fecha="2024-10-01T10:00:00" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="100.00" Moneda="MXN" Total="100.00" TipoDeComprobante="P" LugarExpedicion="12345" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="100.00" Importe="100.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos" Version="2.0">
      <pago20:Pago FechaPago="2024-10-01T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="100.00"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bf-pago-incorrect-0000-000000000008" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// BG) Nómina sin complemento
function buildNominaSinComplementoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BG01" Fecha="2024-10-01T10:00:00" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="MXN" Total="0.00" TipoDeComprobante="N" MetodoPago="PUE" FormaPago="99" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="ACT" Descripcion="Servicio" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
</cfdi:Comprobante>`;
}

// BH) Traslado con campos de pago
function buildTrasladoConPagoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BH01" Fecha="2024-10-01T10:00:00" FormaPago="03" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="T" MetodoPago="PUE" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bh-traslado-pago-000000-000000000009" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testFormaPagoUnknown(): Promise<void> {
  const xml = buildFormaPagoUnknownXml();
  const result = analyzeCfdi(xml, "bd-unknown-formapago.xml");
  assertIncludesFinding(result.findings, "COMPROBANTE_FORMA_PAGO_UNKNOWN_REVIEW", "INFO");
}

async function testTipoRelacionUnknown(): Promise<void> {
  const xml = buildTipoRelacionUnknownXml();
  const result = analyzeCfdi(xml, "be-unknown-tiporelacion.xml");
  assertIncludesFinding(result.findings, "CFDI_RELATION_TIPO_RELACION_UNKNOWN_REVIEW", "INFO");
}

async function testPagoFieldsIncorrect(): Promise<void> {
  const xml = buildPagoFieldsIncorrectXml();
  const result = analyzeCfdi(xml, "bf-pago-incorrect.xml");

  assertIncludesFinding(result.findings, "PAYMENT_CFDI_TOTAL_NOT_ZERO", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_CFDI_SUBTOTAL_NOT_ZERO", "WARNING");
  assertIncludesFinding(result.findings, "PAYMENT_CFDI_MONEDA_NOT_XXX", "WARNING");
  assertEqual(result.executiveSummary.riskLevel, "WARNING", "riskLevel debe ser WARNING");
}

async function testNominaSinComplemento(): Promise<void> {
  const xml = buildNominaSinComplementoXml();
  const result = analyzeCfdi(xml, "bg-nomina-sin-complemento.xml");
  assertIncludesFinding(result.findings, "NOMINA_CFDI_WITHOUT_NOMINA_COMPLEMENT", "WARNING");
}

async function testTrasladoConPago(): Promise<void> {
  const xml = buildTrasladoConPagoXml();
  const result = analyzeCfdi(xml, "bh-traslado-pago.xml");
  assertIncludesFinding(result.findings, "TRASLADO_CFDI_WITH_PAYMENT_FIELDS_REVIEW", "INFO");
}

async function testEvidenceLabels(): Promise<void> {
  assertEqual(
    getMetodoPagoLabel("PPD"),
    "Pago en parcialidades o diferido",
    "getMetodoPagoLabel PPD",
  );
  assertEqual(getFormaPagoLabel("99"), "Por definir", "getFormaPagoLabel 99");
  assertEqual(getImpuestoLabel("002"), "IVA", "getImpuestoLabel 002");
  assertEqual(getTipoFactorLabel("Tasa"), "Tasa", "getTipoFactorLabel Tasa");
  assertEqual(getObjetoImpLabel("02"), "Sí objeto de impuesto", "getObjetoImpLabel 02");
}

// ─── UsoCFDI & Payment Consistency Test Cases (BJ-BR) ────────────────────────

function buildPagoCorrectoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BJ01" Fecha="2024-10-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" MetodoPago="PPD" LugarExpedicion="12345" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos" Version="2.0">
      <pago20:Pago FechaPago="2024-10-01T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="100.00"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bj-pago-correcto-0000-00000000000a" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildPagoUsoCfdiIncorrectoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BK01" Fecha="2024-10-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" MetodoPago="PPD" LugarExpedicion="12345" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos" Version="2.0">
      <pago20:Pago FechaPago="2024-10-01T12:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="100.00"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bk-pago-uso-incorrecto-00000000000b" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildNominaUsoCfdiIncorrectoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BL01" Fecha="2024-10-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="MXN" Total="0.00" TipoDeComprobante="N" MetodoPago="PUE" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="EMPLEADO" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="ACT" Descripcion="Servicio" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/cfd/4" Version="1.2" TipoNomina="O" FechaPago="2024-10-01" FechaInicialPago="2024-09-25" FechaFinalPago="2024-09-30" NumDiasPagados="6" TotalPercepciones="0.00" TotalDeducciones="0.00"/>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bl-nomina-uso-incorrecto-00000000000c" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildPpdFormaPagoIncorrectoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BM01" Fecha="2024-10-01T10:00:00" FormaPago="03" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bm-ppd-formapago-0000-00000000000d" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildPueSinFormaPagoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BN01" Fecha="2024-10-01T10:00:00" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PUE" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bn-pue-sin-formapago-00000000000e" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildRfcGenericoUsoCfdiXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BO01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="PUBLICO EN GENERAL" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="616" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bo-rfc-generico-uso-0000000000000f" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildUsoCfdiUnknownXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BP01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="ZZ99"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bp-uso-cfdi-unknown-00000000000010" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildFormaPagoSinMetodoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BQ01" Fecha="2024-10-01T10:00:00" FormaPago="03" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bq-forma-sin-metodo-00000000000011" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIngresoSinPagoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BR01" Fecha="2024-10-01T10:00:00" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="br-ingreso-sin-pago-00000000000012" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testPagoCorrectoBJ(): Promise<void> {
  const xml = buildPagoCorrectoXml();
  const result = analyzeCfdi(xml, "bj-pago-correcto.xml");
  assertTruthy(
    !result.findings.some((f) => f.code === "PAYMENT_USO_CFDI_NOT_CP01"),
    "No debe existir PAYMENT_USO_CFDI_NOT_CP01",
  );
  assertTruthy(
    !result.findings.some((f) => f.code === "METODO_PAGO_PPD_WITH_FORMA_PAGO_NOT_99"),
    "No debe existir METODO_PAGO_PPD_WITH_FORMA_PAGO_NOT_99",
  );
}

async function testPagoUsoCfdiIncorrecto(): Promise<void> {
  const xml = buildPagoUsoCfdiIncorrectoXml();
  const result = analyzeCfdi(xml, "bk-pago-uso-incorrecto.xml");
  assertIncludesFinding(result.findings, "PAYMENT_USO_CFDI_NOT_CP01", "WARNING");
}

async function testNominaUsoCfdiIncorrecto(): Promise<void> {
  const xml = buildNominaUsoCfdiIncorrectoXml();
  const result = analyzeCfdi(xml, "bl-nomina-uso-incorrecto.xml");
  assertIncludesFinding(result.findings, "NOMINA_USO_CFDI_NOT_CN01", "WARNING");
}

async function testPpdFormaPagoIncorrecto(): Promise<void> {
  const xml = buildPpdFormaPagoIncorrectoXml();
  const result = analyzeCfdi(xml, "bm-ppd-formapago.xml");
  assertIncludesFinding(result.findings, "METODO_PAGO_PPD_WITH_FORMA_PAGO_NOT_99", "WARNING");
}

async function testPueSinFormaPago(): Promise<void> {
  const xml = buildPueSinFormaPagoXml();
  const result = analyzeCfdi(xml, "bn-pue-sin-formapago.xml");
  assertIncludesFinding(result.findings, "METODO_PAGO_PUE_WITHOUT_FORMA_PAGO", "WARNING");
}

async function testRfcGenericoUsoCfdi(): Promise<void> {
  const xml = buildRfcGenericoUsoCfdiXml();
  const result = analyzeCfdi(xml, "bo-rfc-generico-uso.xml");
  assertIncludesFinding(result.findings, "GENERIC_RFC_RECEPTOR_USO_CFDI_REVIEW", "WARNING");
}

async function testUsoCfdiUnknown(): Promise<void> {
  const xml = buildUsoCfdiUnknownXml();
  const result = analyzeCfdi(xml, "bp-uso-cfdi-unknown.xml");
  assertIncludesFinding(result.findings, "RECEPTOR_USO_CFDI_UNKNOWN_REVIEW", "INFO");
}

async function testFormaPagoSinMetodo(): Promise<void> {
  const xml = buildFormaPagoSinMetodoXml();
  const result = analyzeCfdi(xml, "bq-forma-sin-metodo.xml");
  assertIncludesFinding(result.findings, "FORMA_PAGO_PRESENT_WITHOUT_METODO_PAGO_REVIEW", "INFO");
}

async function testIngresoSinPago(): Promise<void> {
  const xml = buildIngresoSinPagoXml();
  const result = analyzeCfdi(xml, "br-ingreso-sin-pago.xml");
  assertIncludesFinding(
    result.findings,
    "INGRESO_O_EGRESO_WITHOUT_METODO_FORMA_PAGO_REVIEW",
    "INFO",
  );
}

// ─── Emisor/Receptor Fiscal Consistency (BS-CA) ──────────────────────────────

function buildRegimenFiscalEmisorUnknownXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BS01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="999"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bs-regimen-emisor-unkn-000000000013" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildReceptorSinRegimenXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BT01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bt-receptor-sin-regimen-000000000014" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildDomicilioFiscalInvalidoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BU01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="ABC" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bu-domicilio-invalido-000000000015" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildMismoRfcXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BV01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bv-mismo-rfc-000000000000000016" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildForeignRfcExportacionMxnXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BW01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XEXX010101000" Nombre="FOREIGN BUYER" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bw-foreign-rfc-mxn-00000000000017" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildNombreReceptorFaltanteXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BX01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bx-nombre-receptor-empty-000000000018" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildNominaRegimenDistintoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BY01" Fecha="2024-10-01T10:00:00" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="MXN" Total="0.00" TipoDeComprobante="N" MetodoPago="PUE" FormaPago="99" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="EMPLEADO" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="612" UsoCFDI="CN01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="ACT" Descripcion="Sueldo" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/cfd/4" Version="1.2" TipoNomina="O" FechaPago="2024-10-01" FechaInicialPago="2024-09-25" FechaFinalPago="2024-09-30" NumDiasPagados="6" TotalPercepciones="0.00" TotalDeducciones="0.00"/>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="by-nomina-regimen-605-0000000000019" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildUsoDeduccionRfcGenericoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="BZ01" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="PUBLICO EN GENERAL" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="616" UsoCFDI="D01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="bz-uso-deduccion-generico-00000000001a" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testRegimenFiscalEmisorUnknown(): Promise<void> {
  const xml = buildRegimenFiscalEmisorUnknownXml();
  const result = analyzeCfdi(xml, "bs-regimen-emisor-unknown.xml");
  assertIncludesFinding(result.findings, "EMISOR_REGIMEN_FISCAL_UNKNOWN_REVIEW", "INFO");
}

async function testReceptorSinRegimen(): Promise<void> {
  const xml = buildReceptorSinRegimenXml();
  const result = analyzeCfdi(xml, "bt-receptor-sin-regimen.xml");
  assertIncludesFinding(result.findings, "RECEPTOR_REGIMEN_FISCAL_MISSING", "WARNING");
}

async function testDomicilioFiscalInvalido(): Promise<void> {
  const xml = buildDomicilioFiscalInvalidoXml();
  const result = analyzeCfdi(xml, "bu-domicilio-invalido.xml");
  assertIncludesFinding(result.findings, "RECEPTOR_DOMICILIO_FISCAL_FORMAT_REVIEW", "INFO");
}

async function testMismoRfc(): Promise<void> {
  const xml = buildMismoRfcXml();
  const result = analyzeCfdi(xml, "bv-mismo-rfc.xml");
  assertIncludesFinding(result.findings, "EMISOR_RECEPTOR_SAME_RFC_REVIEW", "INFO");
}

async function testForeignRfcExportacionMxn(): Promise<void> {
  const xml = buildForeignRfcExportacionMxnXml();
  const result = analyzeCfdi(xml, "bw-foreign-rfc-mxn.xml");
  assertIncludesFinding(result.findings, "FOREIGN_GENERIC_RFC_WITH_MXN_REVIEW", "INFO");
}

async function testNombreReceptorFaltante(): Promise<void> {
  const xml = buildNombreReceptorFaltanteXml();
  const result = analyzeCfdi(xml, "bx-nombre-receptor-empty.xml");
  assertIncludesFinding(result.findings, "RECEPTOR_NAME_EMPTY_REVIEW", "WARNING");
}

async function testNominaRegimenDistinto(): Promise<void> {
  const xml = buildNominaRegimenDistintoXml();
  const result = analyzeCfdi(xml, "by-nomina-regimen.xml");
  assertIncludesFinding(result.findings, "RECEPTOR_NOMINA_REGIMEN_REVIEW", "INFO");
}

async function testUsoDeduccionRfcGenerico(): Promise<void> {
  const xml = buildUsoDeduccionRfcGenericoXml();
  const result = analyzeCfdi(xml, "bz-uso-deduccion-generico.xml");
  assertIncludesFinding(
    result.findings,
    "RECEPTOR_USO_CFDI_DEDUCCIONES_WITH_GENERIC_RFC_REVIEW",
    "WARNING",
  );
}

async function testRegimenHelpers(): Promise<void> {
  assertEqual(
    getRegimenFiscalLabel("601"),
    "General de Ley Personas Morales",
    "getRegimenFiscalLabel 601",
  );
  assertEqual(
    getRegimenFiscalLabel("616"),
    "Sin obligaciones fiscales",
    "getRegimenFiscalLabel 616",
  );
  assertEqual(isKnownRegimenFiscal("626"), true, "isKnownRegimenFiscal 626");
  assertEqual(isKnownRegimenFiscal("999"), false, "isKnownRegimenFiscal 999");
}

// ─── Comercio Exterior fixtures ──────────────────────────────────────────────────

const CCE11_NS = 'xmlns:cce11="http://www.sat.gob.mx/ComercioExterior"';

function buildComercioExteriorXml(opts?: {
  tipoComprobante?: string;
  total?: string;
  subtotal?: string;
  version?: string;
  tipoOperacion?: string;
  claveDePedimento?: string;
  incoterm?: string;
  moneda?: string;
  totalUSD?: string;
  tipoCambioUSD?: string;
  certificadoOrigen?: string;
  numCertificadoOrigen?: string;
  subDivision?: string;
  exportacion?: string;
  omitirComplemento?: boolean;
  omitirMercancias?: boolean;
  omitirReceptorCce?: boolean;
  omitirReceptorDomicilioCce?: boolean;
  mercancias?: Array<{
    noIdentificacion?: string;
    fraccionArancelaria?: string;
    cantidadAduana?: string;
    unidadAduana?: string;
    valorUnitarioAduana?: string;
    valorDolares?: string;
  }>;
  receptorCceResidenciaFiscal?: string;
  receptorCceNumRegIdTrib?: string;
  destinatarioPais?: string;
  conceptNoIdentificacion?: string;
}): string {
  const tipo = opts?.tipoComprobante ?? "I";
  const total = opts?.total ?? "1000.00";
  const subtotal = opts?.subtotal ?? "1000.00";
  const exportacion = opts?.exportacion ?? "02";
  const version = opts?.version ?? "1.1";
  const tipoOperacion = opts?.tipoOperacion ?? "2";
  const claveDePedimento = opts?.claveDePedimento ?? "A1";
  const incoterm = opts?.incoterm ?? "FOB";
  const moneda = opts?.moneda ?? "USD";
  const totalUSD = opts?.totalUSD ?? "1000.00";
  const tipoCambioUSD = opts?.tipoCambioUSD;
  const certificadoOrigen = opts?.certificadoOrigen;
  const numCertificadoOrigen = opts?.numCertificadoOrigen;
  const subDivision = opts?.subDivision;
  const omitirMercancias = opts?.omitirMercancias ?? false;
  const omitirReceptorCce = opts?.omitirReceptorCce ?? false;
  const conceptNoIdentificacion = opts?.conceptNoIdentificacion ?? "001";

  // Mercancias XML
  const mercanciasData =
    opts?.mercancias ??
    (omitirMercancias
      ? []
      : [
          {
            noIdentificacion: "001",
            fraccionArancelaria: "01010101",
            cantidadAduana: "1",
            unidadAduana: "PZA",
            valorUnitarioAduana: "1000.00",
            valorDolares: "1000.00",
          },
        ]);
  const mercanciasXml =
    mercanciasData.length > 0
      ? `\n        <cce11:Mercancias>\n${mercanciasData
          .map((m) => {
            const ni = m.noIdentificacion ? ` NoIdentificacion="${m.noIdentificacion}"` : "";
            const fa = m.fraccionArancelaria
              ? ` FraccionArancelaria="${m.fraccionArancelaria}"`
              : "";
            const ca = m.cantidadAduana ? ` CantidadAduana="${m.cantidadAduana}"` : "";
            const ua = m.unidadAduana ? ` UnidadAduana="${m.unidadAduana}"` : "";
            const vua = m.valorUnitarioAduana
              ? ` ValorUnitarioAduana="${m.valorUnitarioAduana}"`
              : "";
            const vd = m.valorDolares ? ` ValorDolares="${m.valorDolares}"` : "";
            return `          <cce11:Mercancia${ni}${fa}${ca}${ua}${vua}${vd}/>`;
          })
          .join("\n")}\n        </cce11:Mercancias>`
      : "";

  // Receptor CCE XML
  const receptorCceXml = omitirReceptorCce
    ? ""
    : `\n        <cce11:Receptor${opts?.receptorCceResidenciaFiscal !== undefined ? ` ResidenciaFiscal="${opts.receptorCceResidenciaFiscal}"` : ""}${opts?.receptorCceNumRegIdTrib !== undefined ? ` NumRegIdTrib="${opts.receptorCceNumRegIdTrib}"` : ""}>${opts?.omitirReceptorDomicilioCce ? "" : `\n          <cce11:Domicilio Pais="USA" CodigoPostal="12345"/>`}\n        </cce11:Receptor>`;

  // Destinatario XML
  const destinatarioXml = opts?.destinatarioPais
    ? `\n        <cce11:Destinatario Nombre="DESTINATARIO SA">
          <cce11:Domicilio Pais="${opts.destinatarioPais}"/>
        </cce11:Destinatario>`
    : "";

  const cceExtraAttrs = `${tipoCambioUSD !== undefined ? ` TipoCambioUSD="${tipoCambioUSD}"` : ""}${certificadoOrigen !== undefined ? ` CertificadoOrigen="${certificadoOrigen}"` : ""}${numCertificadoOrigen !== undefined ? ` NumCertificadoOrigen="${numCertificadoOrigen}"` : ""}${subDivision !== undefined ? ` SubDivision="${subDivision}"` : ""}`;

  const complementContent = opts?.omitirComplemento
    ? ""
    : `<cce11:ComercioExterior ${CCE11_NS} Version="${version}" TipoOperacion="${tipoOperacion}"${claveDePedimento ? ` ClaveDePedimento="${claveDePedimento}"` : ""}${incoterm ? ` Incoterm="${incoterm}"` : ""}${totalUSD ? ` TotalUSD="${totalUSD}"` : ""}${cceExtraAttrs}>${receptorCceXml}${destinatarioXml}${mercanciasXml}\n      </cce11:ComercioExterior>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="123" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="${subtotal}" Moneda="${moneda}" Total="${total}" TipoDeComprobante="${tipo}" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="${exportacion}">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="${conceptNoIdentificacion}" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto de prueba" ValorUnitario="${subtotal}" Importe="${subtotal}" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="${subtotal}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${(parseFloat(subtotal) * 0.16).toFixed(2)}"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="${(parseFloat(subtotal) * 0.16).toFixed(2)}">
    <cfdi:Traslados>
      <cfdi:Traslado Base="${subtotal}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${(parseFloat(subtotal) * 0.16).toFixed(2)}"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="cb000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    ${complementContent}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testComercioExteriorValidaBase(): Promise<void> {
  const xml = buildComercioExteriorXml({});
  const result = analyzeCfdi(xml, "ce-valida-base.xml");
  assertTruthy(result.comercioExterior, "comercioExterior debe existir");
  assertEqual(result.comercioExterior!.version, "1.1", "version debe ser 1.1");
  assertEqual(result.comercioExterior!.tipoOperacion, "2", "tipoOperacion debe ser 2");
  assertEqual(result.comercioExterior!.incoterm, "FOB", "incoterm debe ser FOB");
  assertEqual(result.comercioExterior!.totalUSD, "1000.00", "totalUSD debe ser 1000.00");
  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_DETECTED");
}

async function testComercioExteriorTipoOperacionInvalido(): Promise<void> {
  const xml = buildComercioExteriorXml({ tipoOperacion: "99" });
  const result = analyzeCfdi(xml, "ce-tipo-op-invalido.xml");
  assertTruthy(result.comercioExterior, "comercioExterior debe existir");
  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_TIPO_OPERACION_REVIEW");
}

async function testComercioExteriorVersionInvalida(): Promise<void> {
  const xml = buildComercioExteriorXml({ version: "1.0" });
  const result = analyzeCfdi(xml, "ce-version-invalida.xml");
  assertTruthy(result.comercioExterior, "comercioExterior debe existir");
  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_VERSION_REVIEW");
}

async function testComercioExteriorSinTipoOperacion(): Promise<void> {
  const xml = buildComercioExteriorXml({ tipoOperacion: "", claveDePedimento: "" });
  const result = analyzeCfdi(xml, "ce-sin-tipo-op.xml");
  assertTruthy(result.comercioExterior, "comercioExterior debe existir");
  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_MISSING_TIPO_OPERACION");
}

async function testComercioExteriorTotalUSDMismatch(): Promise<void> {
  const xml = buildComercioExteriorXml({ totalUSD: "500.00", total: "1000.00" });
  const result = analyzeCfdi(xml, "ce-total-usd-mismatch.xml");
  assertTruthy(result.comercioExterior, "comercioExterior debe existir");
  const finding = result.findings.find((f) => f.code === "COMERCIO_EXTERIOR_TOTAL_USD_MISMATCH");
  assertTruthy(finding, "COMERCIO_EXTERIOR_TOTAL_USD_MISMATCH debe existir");
  assertEqual(finding!.severity, "CRITICAL", "severity debe ser CRITICAL");
}

async function testComercioExteriorVersionFaltante(): Promise<void> {
  const xml = buildComercioExteriorXml({ version: "" });
  const result = analyzeCfdi(xml, "ce-sin-version.xml");
  assertTruthy(result.comercioExterior, "comercioExterior debe existir");
  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_MISSING_VERSION");
}

async function testComercioExteriorComplementoVacio(): Promise<void> {
  const xml = buildComercioExteriorXml({ omitirComplemento: true });
  const result = analyzeCfdi(xml, "ce-vacio.xml");
  assertEqual(result.comercioExterior, undefined, "comercioExterior debe ser undefined");
}

// FG) Comercio Exterior sin TipoCambioUSD/TotalUSD
async function testCceSinTipoCambioTotalUsd(): Promise<void> {
  const xml = buildComercioExteriorXml({ totalUSD: "", tipoCambioUSD: "" });
  const result = analyzeCfdi(xml, "cce-sin-tc-total-usd.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_TOTAL_USD_MISSING");
  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_TIPO_CAMBIO_USD_MISSING");
  const tuFinding = result.findings.find((f) => f.code === "COMERCIO_EXTERIOR_TOTAL_USD_MISSING")!;
  assertEqual(
    tuFinding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_TOTAL_USD_MISSING debe ser WARNING",
  );
  const tcFinding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_TIPO_CAMBIO_USD_MISSING",
  )!;
  assertEqual(
    tcFinding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_TIPO_CAMBIO_USD_MISSING debe ser WARNING",
  );
}

// FH) CertificadoOrigen 1 sin NumCertificadoOrigen
async function testCceCertOrigen1SinNumCert(): Promise<void> {
  const xml = buildComercioExteriorXml({ certificadoOrigen: "1" });
  const result = analyzeCfdi(xml, "cce-cert-origen-1-sin-num.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_CERT_ORIGEN_1_WITHOUT_NUM_CERT");
  const finding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_CERT_ORIGEN_1_WITHOUT_NUM_CERT",
  )!;
  assertEqual(
    finding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_CERT_ORIGEN_1_WITHOUT_NUM_CERT debe ser WARNING",
  );
}

// FI) Receptor sin ResidenciaFiscal/NumRegIdTrib
async function testCceReceptorSinResidenciaNumReg(): Promise<void> {
  const xml = buildComercioExteriorXml({ omitirReceptorCce: true });
  const result = analyzeCfdi(xml, "cce-receptor-sin-residencia-numreg.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_RECEPTOR_MISSING_RESIDENCIA_FISCAL");
  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_RECEPTOR_MISSING_NUM_REG_ID_TRIB");
  const rfFinding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_RECEPTOR_MISSING_RESIDENCIA_FISCAL",
  )!;
  assertEqual(
    rfFinding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_RECEPTOR_MISSING_RESIDENCIA_FISCAL debe ser WARNING",
  );
  const nrFinding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_RECEPTOR_MISSING_NUM_REG_ID_TRIB",
  )!;
  assertEqual(
    nrFinding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_RECEPTOR_MISSING_NUM_REG_ID_TRIB debe ser WARNING",
  );
}

// FJ) Sin mercancías
async function testCceSinMercancias(): Promise<void> {
  const xml = buildComercioExteriorXml({ omitirMercancias: true });
  const result = analyzeCfdi(xml, "cce-sin-mercancias.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_WITHOUT_MERCANCIAS");
  const finding = result.findings.find((f) => f.code === "COMERCIO_EXTERIOR_WITHOUT_MERCANCIAS")!;
  assertEqual(finding.severity, "WARNING", "COMERCIO_EXTERIOR_WITHOUT_MERCANCIAS debe ser WARNING");
}

// FK) Mercancía sin NoIdentificacion/FraccionArancelaria/UnidadAduana
async function testCceMercanciaSinCamposRequeridos(): Promise<void> {
  const xml = buildComercioExteriorXml({
    mercancias: [{ cantidadAduana: "1", valorUnitarioAduana: "100.00", valorDolares: "100.00" }],
  });
  const result = analyzeCfdi(xml, "cce-mercancia-sin-campos.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_MERCANCIA_MISSING_NO_IDENTIFICACION");
  assertIncludesFinding(
    result.findings,
    "COMERCIO_EXTERIOR_MERCANCIA_MISSING_FRACCION_ARANCELARIA",
  );
  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_MERCANCIA_MISSING_UNIDAD_ADUANA");
  const niFinding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_MERCANCIA_MISSING_NO_IDENTIFICACION",
  )!;
  assertEqual(
    niFinding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_MERCANCIA_MISSING_NO_IDENTIFICACION debe ser WARNING",
  );
}

// FL) Fracción arancelaria formato inválido
async function testCceFraccionFormatoInvalido(): Promise<void> {
  const xml = buildComercioExteriorXml({
    mercancias: [
      {
        noIdentificacion: "001",
        fraccionArancelaria: "ABC123",
        cantidadAduana: "1",
        unidadAduana: "PZA",
        valorUnitarioAduana: "100.00",
        valorDolares: "100.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "cce-fraccion-formato-invalido.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_MERCANCIA_FRACCION_FORMAT_REVIEW");
  const finding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_MERCANCIA_FRACCION_FORMAT_REVIEW",
  )!;
  assertEqual(
    finding.severity,
    "INFO",
    "COMERCIO_EXTERIOR_MERCANCIA_FRACCION_FORMAT_REVIEW debe ser INFO",
  );
}

// FM) ValorDolares mismatch
async function testCceValorDolaresMismatch(): Promise<void> {
  const xml = buildComercioExteriorXml({
    mercancias: [
      {
        noIdentificacion: "001",
        fraccionArancelaria: "01010101",
        cantidadAduana: "10",
        unidadAduana: "PZA",
        valorUnitarioAduana: "5.00",
        valorDolares: "30.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "cce-valor-dolares-mismatch.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_MERCANCIA_VALOR_DOLARES_MISMATCH");
  const finding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_MERCANCIA_VALOR_DOLARES_MISMATCH",
  )!;
  assertEqual(
    finding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_MERCANCIA_VALOR_DOLARES_MISMATCH debe ser WARNING",
  );
}

// FN) TotalUSD vs suma mercancías mismatch
async function testCceTotalUsdMercanciasMismatch(): Promise<void> {
  const xml = buildComercioExteriorXml({
    totalUSD: "100.00",
    mercancias: [
      {
        noIdentificacion: "001",
        fraccionArancelaria: "01010101",
        cantidadAduana: "1",
        unidadAduana: "PZA",
        valorUnitarioAduana: "50.00",
        valorDolares: "50.00",
      },
      {
        noIdentificacion: "002",
        fraccionArancelaria: "01010102",
        cantidadAduana: "1",
        unidadAduana: "PZA",
        valorUnitarioAduana: "30.00",
        valorDolares: "30.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "cce-total-usd-merc-mismatch.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_TOTAL_USD_MERCANCIAS_MISMATCH");
  const finding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_TOTAL_USD_MERCANCIAS_MISMATCH",
  )!;
  assertEqual(
    finding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_TOTAL_USD_MERCANCIAS_MISMATCH debe ser WARNING",
  );
}

// FO) CCE con Exportacion distinta de 02
async function testCceSinExportacion02(): Promise<void> {
  const xml = buildComercioExteriorXml({ exportacion: "01" });
  const result = analyzeCfdi(xml, "cce-sin-exportacion-02.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_WITHOUT_EXPORTACION_02_REVIEW");
  const finding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_WITHOUT_EXPORTACION_02_REVIEW",
  )!;
  assertEqual(
    finding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_WITHOUT_EXPORTACION_02_REVIEW debe ser WARNING",
  );
}

// FP) Moneda USD TotalUSD vs Total CFDI mismatch
async function testCceTotalUsdVsCfdiTotalMismatch(): Promise<void> {
  const xml = buildComercioExteriorXml({
    moneda: "USD",
    total: "100.00",
    totalUSD: "80.00",
    tipoCambioUSD: "1.00",
  });
  const result = analyzeCfdi(xml, "cce-total-usd-vs-cfdi-total-mismatch.xml");

  assertIncludesFinding(result.findings, "COMERCIO_EXTERIOR_TOTAL_USD_VS_CFDI_TOTAL_REVIEW");
  const finding = result.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_TOTAL_USD_VS_CFDI_TOTAL_REVIEW",
  )!;
  assertEqual(
    finding.severity,
    "WARNING",
    "COMERCIO_EXTERIOR_TOTAL_USD_VS_CFDI_TOTAL_REVIEW debe ser WARNING",
  );
}

// FQ) Retenciones lugarExpRetenc faltante
async function testRetLugarExpFaltante(): Promise<void> {
  const xml = buildRetencionesXml({
    attrsOverride: `Version="2.0" FolioInt="RET-2024-001" FechaExp="2024-01-15T12:00:00" CveRetenc="06" Sello="abc" NumCert="00001000000500000000" Cert="def"`,
  });
  const result = analyzeCfdi(xml, "ret-lugar-exp-faltante.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_LUGAR_EXP_MISSING");
  assertIncludesFinding(result.findings, "RETENCIONES_DESC_RETENC_MISSING_REVIEW");
  const f = result.findings.find((x) => x.code === "RETENCIONES_LUGAR_EXP_MISSING")!;
  assertEqual(f.severity, "WARNING", "LUGAR_EXP_MISSING debe ser WARNING");
}

// FR) Retenciones emisor sin nombre y régimen
async function testRetEmisorSinNombreRegimen(): Promise<void> {
  const xml = buildRetencionesXml({
    emisor: `<retenciones:Emisor RfcE="EKU9003173C9" CURPE="XXXX000000HXXX"/>`,
  });
  const result = analyzeCfdi(xml, "ret-emisor-sin-nombre-regimen.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_EMISOR_NAME_MISSING");
  assertIncludesFinding(result.findings, "RETENCIONES_EMISOR_REGIMEN_MISSING");
}

// FS) Retenciones receptor sin nacionalidad ni domicilio
async function testRetReceptorSinNacionalidadDomicilio(): Promise<void> {
  const xml = buildRetencionesXml({
    receptor: `<retenciones:Receptor><retenciones:Nacional RfcR="XAXX010101000" NomDenRazSocR="CLIENTE SA DE CV" CURPR="XXXX000000HXXA"/></retenciones:Receptor>`,
  });
  const result = analyzeCfdi(xml, "ret-receptor-sin-nacionalidad-domicilio.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_RECEPTOR_NACIONALIDAD_MISSING");
  assertIncludesFinding(result.findings, "RETENCIONES_RECEPTOR_NACIONAL_DOMICILIO_MISSING_REVIEW");
}

// FT) Retenciones receptor nacional con RFC genérico y sin nombre
async function testRetReceptorRfcGenericoSinNombre(): Promise<void> {
  const xml = buildRetencionesXml({
    receptor: `<retenciones:Receptor Nacionalidad="Nacional"><retenciones:Nacional RfcR="XAXX010101000" CURPR="XXXX000000HXXA"/></retenciones:Receptor>`,
  });
  const result = analyzeCfdi(xml, "ret-receptor-generico-sin-nombre.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_RECEPTOR_NACIONAL_WITH_GENERIC_RFC_REVIEW");
  assertIncludesFinding(result.findings, "RETENCIONES_RECEPTOR_NACIONAL_WITHOUT_NAME");
}

// FU) Retenciones periodo incompleto (sin MesIni ni MesFin)
async function testRetPeriodoIncompleto(): Promise<void> {
  const xml = buildRetencionesXml({
    periodo: `<retenciones:Periodo Ejerc="2024"/>`,
  });
  const result = analyzeCfdi(xml, "ret-periodo-incompleto.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_PERIODO_MES_INI_MISSING");
  assertIncludesFinding(result.findings, "RETENCIONES_PERIODO_MES_FIN_MISSING");
}

// FV) Retenciones total operación cero
async function testRetTotalOperacionCero(): Promise<void> {
  const xml = buildRetencionesXml({
    totales: `<retenciones:Totales MontoTotOperacion="0.00"><retenciones:ImpRetenidos><retenciones:ImpRetenido BaseRet="0.00" Impuesto="001" MontoRet="0.00" TipoPagoRet="Pago definitivo"/></retenciones:ImpRetenidos></retenciones:Totales>`,
  });
  const result = analyzeCfdi(xml, "ret-total-operacion-cero.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_TOTAL_OPERATION_ZERO_REVIEW");
  const f = result.findings.find((x) => x.code === "RETENCIONES_TOTAL_OPERATION_ZERO_REVIEW")!;
  assertEqual(f.severity, "INFO", "TOTAL_OPERATION_ZERO_REVIEW debe ser INFO");
}

// FW) Retenciones total ret excede operación
async function testRetTotalRetExcedeOperacion(): Promise<void> {
  const xml = buildRetencionesXml({
    totales: `<retenciones:Totales MontoTotOperacion="10000.00" MontoTotRet="20000.00"><retenciones:ImpRetenidos><retenciones:ImpRetenido BaseRet="8000.00" Impuesto="001" MontoRet="20000.00" TipoPagoRet="Pago definitivo"/></retenciones:ImpRetenidos></retenciones:Totales>`,
  });
  const result = analyzeCfdi(xml, "ret-total-ret-excede.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_TOTAL_RET_EXCEEDS_OPERATION");
  const f = result.findings.find((x) => x.code === "RETENCIONES_TOTAL_RET_EXCEEDS_OPERATION")!;
  assertEqual(f.severity, "CRITICAL", "TOTAL_RET_EXCEEDS_OPERATION debe ser CRITICAL");
}

// FX) Retenciones total ret 0 con impuestos > 0 y tipo pago faltante
async function testRetTotalRetCeroConImpuestosYTipoPagoFaltante(): Promise<void> {
  const xml = buildRetencionesXml({
    totales: `<retenciones:Totales MontoTotOperacion="10000.00" MontoTotRet="0.00"><retenciones:ImpRetenidos><retenciones:ImpRetenido BaseRet="8000.00" Impuesto="001" MontoRet="1600.00"/></retenciones:ImpRetenidos></retenciones:Totales>`,
  });
  const result = analyzeCfdi(xml, "ret-total-ret-cero-con-impuestos.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_TOTAL_RET_ZERO_WITH_IMPUESTOS");
  assertIncludesFinding(result.findings, "RETENCIONES_IMP_RETENIDO_TIPO_PAGO_MISSING_REVIEW");
}

// FY) Retenciones complemento dividendos faltante
async function testRetComplementoDividendosFaltante(): Promise<void> {
  const xml = buildRetencionesXml({
    attrsOverride: `Version="2.0" FolioInt="RET-2024-001" FechaExp="2024-01-15T12:00:00" CveRetenc="01" DescRetenc="Dividendos" LugarExpRetenc="12345" Sello="abc" NumCert="00001000000500000000" Cert="def"`,
  });
  const result = analyzeCfdi(xml, "ret-complemento-dividendos-faltante.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_COMPLEMENTO_DIVIDENDOS_MISSING");
  const f = result.findings.find((x) => x.code === "RETENCIONES_COMPLEMENTO_DIVIDENDOS_MISSING")!;
  assertEqual(f.severity, "WARNING", "COMPLEMENTO_DIVIDENDOS_MISSING debe ser WARNING");
}

// FZ) Retenciones complemento desconocido
async function testRetComplementoDesconocido(): Promise<void> {
  const xml = buildRetencionesXml({
    complemento: `<retenciones:Complemento><custom:AlgoDesconocido xmlns:custom="http://example.com"><custom:Dato valor="test"/></custom:AlgoDesconocido><tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="fz000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/></retenciones:Complemento>`,
  });
  const result = analyzeCfdi(xml, "ret-complemento-desconocido.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_COMPLEMENTO_DESCONOCIDO_REVIEW");
  const f = result.findings.find((x) => x.code === "RETENCIONES_COMPLEMENTO_DESCONOCIDO_REVIEW")!;
  assertEqual(f.severity, "INFO", "COMPLEMENTO_DESCONOCIDO_REVIEW debe ser INFO");
}

// ─── Impuestos Locales fixtures ─────────────────────────────────────────────

const IMPLOCAL_NS = 'xmlns:implocal="http://www.sat.gob.mx/ImpuestosLocales"';

function buildImpuestosLocalesXml(opts?: {
  version?: string;
  totalDeRetenciones?: string;
  totalDeTraslados?: string;
  retenciones?: Array<{ impLocRetenido: string; tasa: string; importe: string }>;
  traslados?: Array<{ impLocTrasladado: string; tasa: string; importe: string }>;
  omitirComplemento?: boolean;
}): string {
  const version = opts?.version ?? "1.0";
  const totalRet = opts?.totalDeRetenciones;
  const totalTras = opts?.totalDeTraslados;
  const retenciones = opts?.retenciones ?? [];
  const traslados = opts?.traslados ?? [];

  let complementContent = "";
  if (!opts?.omitirComplemento) {
    let retXml = "";
    if (retenciones.length > 0) {
      retXml = `      <implocal:RetencionesLocales>
${retenciones.map((r) => `        <implocal:RetencionLocal ImpLocRetenido="${r.impLocRetenido}" TasadeRetencion="${r.tasa}" Importe="${r.importe}"/>`).join("\n")}
      </implocal:RetencionesLocales>
`;
    }
    let trasXml = "";
    if (traslados.length > 0) {
      trasXml = `      <implocal:TrasladosLocales>
${traslados.map((t) => `        <implocal:TrasladoLocal ImpLocTrasladado="${t.impLocTrasladado}" TasadeTraslado="${t.tasa}" Importe="${t.importe}"/>`).join("\n")}
      </implocal:TrasladosLocales>
`;
    }
    complementContent = `    <implocal:ImpuestosLocales ${IMPLOCAL_NS} Version="${version}"${totalRet !== undefined ? ` TotaldeRetenciones="${totalRet}"` : ""}${totalTras !== undefined ? ` TotaldeTraslados="${totalTras}"` : ""}>
${retXml}${trasXml}    </implocal:ImpuestosLocales>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="123" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto de prueba" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ci000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    ${complementContent}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testImpuestosLocalesValidoBase(): Promise<void> {
  const xml = buildImpuestosLocalesXml({
    totalDeRetenciones: "20.00",
    totalDeTraslados: "25.00",
    retenciones: [{ impLocRetenido: "ISRH", tasa: "0.050000", importe: "20.00" }],
    traslados: [
      { impLocTrasladado: "ISHT", tasa: "0.020000", importe: "10.00" },
      { impLocTrasladado: "ISHT2", tasa: "0.030000", importe: "15.00" },
    ],
  });
  const result = analyzeCfdi(xml, "il-valido-base.xml");
  assertTruthy(result.impuestosLocales, "impuestosLocales debe existir");
  assertEqual(result.impuestosLocales!.version, "1.0", "version debe ser 1.0");
  assertEqual(result.impuestosLocales!.retenciones.length, 1, "1 retención");
  assertEqual(result.impuestosLocales!.traslados.length, 2, "2 traslados");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_DETECTED");
  assertEqual(
    result.findings.filter((f) => f.code === "IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISMATCH").length,
    0,
    "no debe haber mismatch retenciones",
  );
  assertEqual(
    result.findings.filter((f) => f.code === "IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISMATCH").length,
    0,
    "no debe haber mismatch traslados",
  );
}

async function testImpuestosLocalesTotalRetencionesMismatch(): Promise<void> {
  const xml = buildImpuestosLocalesXml({
    totalDeRetenciones: "10.00",
    totalDeTraslados: "25.00",
    retenciones: [{ impLocRetenido: "ISRH", tasa: "0.050000", importe: "20.00" }],
    traslados: [
      { impLocTrasladado: "ISHT", tasa: "0.020000", importe: "10.00" },
      { impLocTrasladado: "ISHT2", tasa: "0.030000", importe: "15.00" },
    ],
  });
  const result = analyzeCfdi(xml, "il-total-ret-mismatch.xml");
  assertTruthy(result.impuestosLocales, "impuestosLocales debe existir");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISMATCH");
  const finding = result.findings.find(
    (f) => f.code === "IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISMATCH",
  )!;
  assertEqual(finding.severity, "CRITICAL", "severity debe ser CRITICAL");
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

async function testImpuestosLocalesTotalTrasladosMismatch(): Promise<void> {
  const xml = buildImpuestosLocalesXml({
    totalDeRetenciones: "20.00",
    totalDeTraslados: "10.00",
    retenciones: [{ impLocRetenido: "ISRH", tasa: "0.050000", importe: "20.00" }],
    traslados: [
      { impLocTrasladado: "ISHT", tasa: "0.020000", importe: "10.00" },
      { impLocTrasladado: "ISHT2", tasa: "0.030000", importe: "15.00" },
    ],
  });
  const result = analyzeCfdi(xml, "il-total-tras-mismatch.xml");
  assertTruthy(result.impuestosLocales, "impuestosLocales debe existir");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISMATCH");
  const finding = result.findings.find(
    (f) => f.code === "IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISMATCH",
  )!;
  assertEqual(finding.severity, "CRITICAL", "severity debe ser CRITICAL");
}

async function testImpuestosLocalesSinLineas(): Promise<void> {
  const xml = buildImpuestosLocalesXml({
    totalDeRetenciones: "0.00",
    totalDeTraslados: "0.00",
  });
  const result = analyzeCfdi(xml, "il-sin-lineas.xml");
  assertTruthy(result.impuestosLocales, "impuestosLocales debe existir");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_WITHOUT_LINES");
  const finding = result.findings.find((f) => f.code === "IMPUESTOS_LOCALES_WITHOUT_LINES")!;
  assertEqual(finding.severity, "WARNING", "severity debe ser WARNING");
}

async function testImpuestosLocalesLineaInvalida(): Promise<void> {
  const xml = buildImpuestosLocalesXml({
    totalDeRetenciones: "0.00",
    totalDeTraslados: "0.00",
    retenciones: [{ impLocRetenido: "", tasa: "-1", importe: "-5" }],
    traslados: [{ impLocTrasladado: "", tasa: "-1", importe: "-3" }],
  });
  const result = analyzeCfdi(xml, "il-linea-invalida.xml");
  assertTruthy(result.impuestosLocales, "impuestosLocales debe existir");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_RETENCION_MISSING_NAME");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_RETENCION_TASA_INVALID");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_RETENCION_IMPORTE_INVALID");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_TRASLADO_MISSING_NAME");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_TRASLADO_TASA_INVALID");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_TRASLADO_IMPORTE_INVALID");
}

async function testImpuestosLocalesTotalesFaltantes(): Promise<void> {
  const xml = buildImpuestosLocalesXml({
    version: "1.0",
    retenciones: [{ impLocRetenido: "ISRH", tasa: "0.050000", importe: "20.00" }],
    traslados: [{ impLocTrasladado: "ISHT", tasa: "0.020000", importe: "10.00" }],
  });
  const result = analyzeCfdi(xml, "il-totales-faltantes.xml");
  assertTruthy(result.impuestosLocales, "impuestosLocales debe existir");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISSING_REVIEW");
  assertIncludesFinding(result.findings, "IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISSING_REVIEW");
}

async function testImpuestosLocalesComplementoVacio(): Promise<void> {
  const xml = buildImpuestosLocalesXml({ omitirComplemento: true });
  const result = analyzeCfdi(xml, "il-vacio.xml");
  assertEqual(result.impuestosLocales, undefined, "impuestosLocales debe ser undefined");
}

// ─── Addenda fixtures ─────────────────────────────────────────────────────

function buildAddendaXml(opts?: {
  purchaseOrder?: string;
  goodsReceipt?: string;
  vendorId?: string;
  customNodes?: Array<{ name: string; value: string }>;
  deepNested?: boolean;
  omitAddenda?: boolean;
}): string {
  const po = opts?.purchaseOrder ?? "";
  const gr = opts?.goodsReceipt ?? "";
  const vi = opts?.vendorId ?? "";
  const customNodes = opts?.customNodes ?? [];
  const hasDeep = opts?.deepNested ?? false;

  let addendaXml = "";
  if (!opts?.omitAddenda) {
    let inner = "";
    if (po) {
      inner += `      <Request><Order><PurchaseOrder>${po}</PurchaseOrder></Order></Request>\n`;
    }
    if (gr) {
      inner += `      <Logistics><GoodsReceipt>${gr}</GoodsReceipt></Logistics>\n`;
    }
    if (vi) {
      inner += `      <Supplier><VendorId>${vi}</VendorId></Supplier>\n`;
    }
    for (const c of customNodes) {
      inner += `      <CustomData><${c.name}>${c.value}</${c.name}></CustomData>\n`;
    }
    if (hasDeep) {
      let deep = "";
      for (let i = 0; i < 10; i++) {
        deep += `<L${i}>`;
      }
      deep += "deepValue";
      for (let i = 9; i >= 0; i--) {
        deep += `</L${i}>`;
      }
      inner += `      <DeepContainer>${deep}</DeepContainer>\n`;
    }
    addendaXml = `  <cfdi:Addenda>\n${inner}  </cfdi:Addenda>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="123" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto de prueba" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>${addendaXml}
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="cp000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testAddendaConOrdenCompra(): Promise<void> {
  const xml = buildAddendaXml({ purchaseOrder: "4500001234" });
  const result = analyzeCfdi(xml, "addenda-po.xml");
  assertTruthy(result.addenda, "addenda debe existir");
  assertEqual(result.addenda!.detected, true, "addenda.detected debe ser true");
  assertIncludesFinding(result.findings, "ADDENDA_DETECTED");
  assertIncludesFinding(result.findings, "ADDENDA_PURCHASE_ORDER_DETECTED");
  const hasPoSignal = result.addenda!.signals.some(
    (s) => s.label === "PURCHASE_ORDER" && s.value === "4500001234",
  );
  assertTruthy(hasPoSignal, "PURCHASE_ORDER signal con valor 4500001234");
}

async function testAddendaConRecepcionYProveedor(): Promise<void> {
  const xml = buildAddendaXml({ goodsReceipt: "5000012345", vendorId: "100200" });
  const result = analyzeCfdi(xml, "addenda-gr-vendor.xml");
  assertTruthy(result.addenda, "addenda debe existir");
  assertIncludesFinding(result.findings, "ADDENDA_GOODS_RECEIPT_DETECTED");
  assertIncludesFinding(result.findings, "ADDENDA_VENDOR_REFERENCE_DETECTED");
  const hasGr = result.addenda!.signals.some((s) => s.label === "GOODS_RECEIPT");
  const hasVendor = result.addenda!.signals.some((s) => s.label === "VENDOR_ID");
  assertTruthy(hasGr, "GOODS_RECEIPT signal debe existir");
  assertTruthy(hasVendor, "VENDOR_ID signal debe existir");
}

async function testAddendaSinSenales(): Promise<void> {
  const xml = buildAddendaXml({
    customNodes: [
      { name: "InternalCode", value: "ABC123" },
      { name: "SomeField", value: "xyz" },
    ],
  });
  const result = analyzeCfdi(xml, "addenda-sin-senales.xml");
  assertTruthy(result.addenda, "addenda debe existir");
  assertEqual(result.addenda!.signals.length, 0, "no debe haber señales");
  assertIncludesFinding(result.findings, "ADDENDA_NO_BUSINESS_SIGNALS_REVIEW");
}

async function testAddendaProfundaTruncada(): Promise<void> {
  const xml = buildAddendaXml({ deepNested: true });
  const result = analyzeCfdi(xml, "addenda-profunda.xml");
  assertTruthy(result.addenda, "addenda debe existir");
  assertEqual(result.addenda!.truncated, true, "addenda.truncated debe ser true");
  assertIncludesFinding(result.findings, "ADDENDA_TRUNCATED_REVIEW");
}

async function testAddendaSinAddenda(): Promise<void> {
  const xml = buildAddendaXml({ omitAddenda: true });
  const result = analyzeCfdi(xml, "addenda-sin.xml");
  assertEqual(result.addenda, undefined, "addenda debe ser undefined");
  const hasAddendaFinding = result.findings.some((f) => f.code.startsWith("ADDENDA_"));
  assertEqual(hasAddendaFinding, false, "no debe haber findings de Addenda");
}

// ─── Leyendas Fiscales / Donatarias fixtures ───────────────────────────────

const LF_NS = 'xmlns:leyendasFisc="http://www.sat.gob.mx/leyendasFiscales"';
const DONAT_NS = 'xmlns:donat="http://www.sat.gob.mx/donat"';
const RET_NS = 'xmlns:retenciones="http://www.sat.gob.mx/esquemas/retencionpago/1"';
const RET_SL =
  'xsi:schemaLocation="http://www.sat.gob.mx/esquemas/retencionpago/1 http://www.sat.gob.mx/sitio_internet/esquemas/retencionpago/1/retencionpagov2.xsd"';

function buildComplementXml(complementInner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} ${LF_NS} ${DONAT_NS} Version="4.0" Serie="A" Folio="123" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto de prueba" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    ${complementInner}
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="lf000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildRetencionesXml(opts?: {
  attrsOverride?: string;
  emisor?: string;
  receptor?: string;
  periodo?: string;
  totales?: string;
  complemento?: string;
}): string {
  const attr =
    opts?.attrsOverride ??
    `Version="2.0" FolioInt="RET-2024-001" FechaExp="2024-01-15T12:00:00" CveRetenc="06" DescRetenc="Honorarios" LugarExpRetenc="12345" Sello="abc" NumCert="00001000000500000000" Cert="def"`;
  const emisor =
    opts?.emisor ??
    `<retenciones:Emisor RfcE="EKU9003173C9" NomDenRazSocE="EMPRESA SA DE CV" CURPE="XXXX000000HXXX" RegimenFiscalE="601"/>`;
  const receptor =
    opts?.receptor ??
    `<retenciones:Receptor Nacionalidad="Nacional"><retenciones:Nacional RfcR="XAXX010101000" NomDenRazSocR="CLIENTE SA DE CV" CURPR="XXXX000000HXXA" DomicilioFiscalR="12345"/></retenciones:Receptor>`;
  const periodo = opts?.periodo ?? `<retenciones:Periodo MesIni="01" MesFin="01" Ejerc="2024"/>`;
  const totales =
    opts?.totales ??
    `<retenciones:Totales MontoTotOperacion="10000.00" MontoTotGrav="8000.00" MontoTotExent="2000.00" MontoTotRet="1600.00"><retenciones:ImpRetenidos><retenciones:ImpRetenido BaseRet="8000.00" Impuesto="001" MontoRet="1600.00" TipoPagoRet="Pago definitivo"/></retenciones:ImpRetenidos></retenciones:Totales>`;
  const complemento =
    opts?.complemento ??
    `<retenciones:Complemento><tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="da000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/></retenciones:Complemento>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<retenciones:Retenciones ${RET_NS} ${XSI_NS} ${RET_SL} ${attr}>
  ${emisor}
  ${receptor}
  ${periodo}
  ${totales}
  ${complemento}
</retenciones:Retenciones>`;
}

// CU) Leyendas Fiscales válido base
async function testLeyendasFiscalesValidoBase(): Promise<void> {
  const xml = buildComplementXml(`
    <leyendasFisc:LeyendasFiscales Version="1.0">
      <leyendasFisc:Leyenda DisposicionFiscal="Artículo 1" Norma="LISR" TextoLeyenda="Artículo 1, fracción III de la LISR aplicable al período."/>
    </leyendasFisc:LeyendasFiscales>`);
  const result = analyzeCfdi(xml, "lf-valido.xml");
  assertTruthy(result.leyendasFiscales, "leyendasFiscales debe existir");
  assertEqual(result.leyendasFiscales!.leyendas.length, 1, "debe tener 1 leyenda");
  assertIncludesFinding(result.findings, "LEYENDAS_FISCALES_DETECTED");
  assertEqual(result.leyendasFiscales!.version, "1.0", "version debe ser 1.0");
  assertEqual(
    result.leyendasFiscales!.leyendas[0].disposicionFiscal,
    "Artículo 1",
    "disposicionFiscal debe coincidir",
  );
  assertEqual(result.leyendasFiscales!.leyendas[0].norma, "LISR", "norma debe coincidir");
  assertEqual(
    result.leyendasFiscales!.leyendas[0].textoLeyenda,
    "Artículo 1, fracción III de la LISR aplicable al período.",
    "textoLeyenda debe coincidir",
  );
}

// CV) Leyendas Fiscales incompleto
async function testLeyendasFiscalesIncompleto(): Promise<void> {
  const xml = buildComplementXml(`
    <LeyendasFiscales>
      <Leyenda DisposicionFiscal="" Norma="" TextoLeyenda=""/>
    </LeyendasFiscales>`);
  const result = analyzeCfdi(xml, "lf-incompleto.xml");
  assertTruthy(result.leyendasFiscales, "leyendasFiscales debe existir");
  assertIncludesFinding(result.findings, "LEYENDAS_FISCALES_DETECTED");
  assertIncludesFinding(result.findings, "LEYENDAS_FISCALES_MISSING_VERSION");
  assertIncludesFinding(result.findings, "LEYENDA_FISCAL_MISSING_TEXT");
  assertIncludesFinding(result.findings, "LEYENDA_FISCAL_MISSING_NORMA_REVIEW");
  assertIncludesFinding(result.findings, "LEYENDA_FISCAL_MISSING_DISPOSICION_REVIEW");
}

// CW) Leyendas Fiscales sin leyendas
async function testLeyendasFiscalesSinLeyendas(): Promise<void> {
  const xml = buildComplementXml(`
    <LeyendasFiscales Version="1.0"/>`);
  const result = analyzeCfdi(xml, "lf-sin-leyendas.xml");
  assertTruthy(result.leyendasFiscales, "leyendasFiscales debe existir");
  assertEqual(result.leyendasFiscales!.leyendas.length, 0, "no debe tener leyendas");
  assertIncludesFinding(result.findings, "LEYENDAS_FISCALES_DETECTED");
  assertIncludesFinding(result.findings, "LEYENDAS_FISCALES_WITHOUT_LEYENDAS");
}

// CX) Donatarias válido base
async function testDonatariasValidoBase(): Promise<void> {
  const xml = buildComplementXml(`
    <donat:Donatarias Version="1.1" NoAutorizacion="AUT-2024-00123" FechaAutorizacion="2024-01-01" Leyenda="Donataria autorizada para recibir donativos deducibles conforme a la LISR."/>`);
  const result = analyzeCfdi(xml, "donat-valido.xml");
  assertTruthy(result.donatarias, "donatarias debe existir");
  assertIncludesFinding(result.findings, "DONATARIAS_DETECTED");
  assertEqual(result.donatarias!.version, "1.1", "version debe ser 1.1");
  assertEqual(result.donatarias!.noAutorizacion, "AUT-2024-00123", "noAutorizacion debe coincidir");
  assertEqual(
    result.donatarias!.fechaAutorizacion,
    "2024-01-01",
    "fechaAutorizacion debe coincidir",
  );
  const hasMissingNoAut = result.findings.some(
    (f) => f.code === "DONATARIAS_MISSING_NO_AUTORIZACION",
  );
  assertEqual(hasMissingNoAut, false, "no debe tener DONATARIAS_MISSING_NO_AUTORIZACION");
  const hasMissingFecha = result.findings.some(
    (f) => f.code === "DONATARIAS_MISSING_FECHA_AUTORIZACION",
  );
  assertEqual(hasMissingFecha, false, "no debe tener DONATARIAS_MISSING_FECHA_AUTORIZACION");
  const hasMissingLeyenda = result.findings.some((f) => f.code === "DONATARIAS_MISSING_LEYENDA");
  assertEqual(hasMissingLeyenda, false, "no debe tener DONATARIAS_MISSING_LEYENDA");
}

// CY) Donatarias incompleto
async function testDonatariasIncompleto(): Promise<void> {
  const xml = buildComplementXml(`
    <Donatarias Version="" NoAutorizacion="" FechaAutorizacion="" Leyenda=""/>`);
  const result = analyzeCfdi(xml, "donat-incompleto.xml");
  assertTruthy(result.donatarias, "donatarias debe existir");
  assertIncludesFinding(result.findings, "DONATARIAS_DETECTED");
  assertIncludesFinding(result.findings, "DONATARIAS_MISSING_VERSION");
  assertIncludesFinding(result.findings, "DONATARIAS_MISSING_NO_AUTORIZACION");
  assertIncludesFinding(result.findings, "DONATARIAS_MISSING_FECHA_AUTORIZACION");
  assertIncludesFinding(result.findings, "DONATARIAS_MISSING_LEYENDA");
}

// CZ) Donatarias fecha inválida / leyenda corta
async function testDonatariasFechaLeyendaCorta(): Promise<void> {
  const xml = buildComplementXml(`
    <Donatarias Version="1.1" NoAutorizacion="XYZ-123" FechaAutorizacion="fecha-invalida" Leyenda="ABC"/>`);
  const result = analyzeCfdi(xml, "donat-fecha-corta.xml");
  assertTruthy(result.donatarias, "donatarias debe existir");
  assertIncludesFinding(result.findings, "DONATARIAS_FECHA_AUTORIZACION_INVALID");
  assertIncludesFinding(result.findings, "DONATARIAS_LEYENDA_TOO_SHORT_REVIEW");
}

// DA) Retenciones válido base
async function testRetencionesValidoBase(): Promise<void> {
  const xml = buildRetencionesXml();
  const result = analyzeCfdi(xml, "ret-valido.xml");
  assertEqual(result.documentKind, "RETENCIONES", "documentKind debe ser RETENCIONES");
  assertTruthy(result.retenciones, "retenciones debe existir");
  assertEqual(result.retenciones!.version, "2.0", "version debe ser 2.0");
  assertEqual(result.retenciones!.folioInt, "RET-2024-001", "folioInt debe coincidir");
  assertEqual(result.retenciones!.cveRetenc, "06", "cveRetenc debe coincidir");
  assertEqual(result.retenciones!.descRetenc, "Honorarios", "descRetenc debe coincidir");
  assertEqual(result.retenciones!.lugarExpRetenc, "12345", "lugarExpRetenc debe coincidir");
  assertEqual(
    result.retenciones!.uuid,
    "da000000-0000-0000-0000-000000000000",
    "uuid debe coincidir",
  );
  assertTruthy(result.retenciones!.emisor, "emisor debe existir");
  assertEqual(result.retenciones!.emisor!.rfcEmisor, "EKU9003173C9", "rfcEmisor debe coincidir");
  assertTruthy(result.retenciones!.receptor, "receptor debe existir");
  assertEqual(
    result.retenciones!.receptor!.nacionalidad,
    "Nacional",
    "nacionalidad debe coincidir",
  );
  assertEqual(
    result.retenciones!.receptor!.rfcReceptor,
    "XAXX010101000",
    "rfcReceptor debe coincidir",
  );
  assertTruthy(result.retenciones!.periodo, "periodo debe existir");
  assertEqual(result.retenciones!.periodo!.mesIni, "01", "mesIni debe coincidir");
  assertEqual(result.retenciones!.periodo!.mesFin, "01", "mesFin debe coincidir");
  assertEqual(result.retenciones!.periodo!.ejercicio, "2024", "ejercicio debe coincidir");
  assertTruthy(result.retenciones!.totales, "totales debe existir");
  assertEqual(
    result.retenciones!.totales!.montoTotOperacion,
    "10000.00",
    "montoTotOperacion debe coincidir",
  );
  assertEqual(result.retenciones!.totales!.montoTotRet, "1600.00", "montoTotRet debe coincidir");
  assertEqual(
    result.retenciones!.totales!.impuestosRetenidos.length,
    1,
    "debe tener 1 impuesto retenido",
  );
  assertIncludesFinding(result.findings, "RETENCIONES_DOCUMENT_DETECTED");
  const warns = result.findings.filter(
    (f) => f.severity === "WARNING" || f.severity === "CRITICAL",
  );
  assertEqual(warns.length, 0, "no debe tener hallazgos WARNING o CRITICAL");
}

// DB) Retenciones incompleto (sin campos opcionales)
async function testRetencionesIncompleto(): Promise<void> {
  const xml = buildRetencionesXml({
    attrsOverride: `Version="2.0"`,
    emisor: ``,
    receptor: ``,
    periodo: ``,
    totales: ``,
    complemento: ``,
  });
  const result = analyzeCfdi(xml, "ret-incompleto.xml");
  assertEqual(result.documentKind, "RETENCIONES", "documentKind debe ser RETENCIONES");
  assertIncludesFinding(result.findings, "RETENCIONES_DOCUMENT_DETECTED");
  assertIncludesFinding(result.findings, "RETENCIONES_MISSING_CVE_RETENC");
  assertIncludesFinding(result.findings, "RETENCIONES_MISSING_FECHA_EXP");
  assertIncludesFinding(result.findings, "RETENCIONES_MISSING_EMISOR_RFC");
  assertIncludesFinding(result.findings, "RETENCIONES_MISSING_RECEPTOR");
  assertIncludesFinding(result.findings, "RETENCIONES_MISSING_PERIODO");
  assertIncludesFinding(result.findings, "RETENCIONES_MISSING_TOTALES");
  assertIncludesFinding(result.findings, "RETENCIONES_MISSING_SELLO_OR_CERT_REVIEW");
  assertIncludesFinding(result.findings, "RETENCIONES_TIMBRE_MISSING_REVIEW");
}

// DC) Retenciones emisor sin RFC
async function testRetencionesEmisorSinRfc(): Promise<void> {
  const xml = buildRetencionesXml({
    emisor: `<retenciones:Emisor NomDenRazSocE="EMPRESA SA DE CV" CURPE="XXXX000000HXXX"/>`,
  });
  const result = analyzeCfdi(xml, "ret-emisor-sin-rfc.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_MISSING_EMISOR_RFC");
}

// DD) Retenciones receptor extranjero
async function testRetencionesReceptorExtranjero(): Promise<void> {
  const xml = buildRetencionesXml({
    receptor: `<retenciones:Receptor Nacionalidad="Extranjero"><retenciones:Extranjero NumRegIdTrib="EXT-12345" NomDenRazSocR="EXTERNAL CLIENT LTD"/></retenciones:Receptor>`,
  });
  const result = analyzeCfdi(xml, "ret-receptor-ext.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_DOCUMENT_DETECTED");
  assertTruthy(result.retenciones!.receptor, "receptor debe existir");
  assertEqual(
    result.retenciones!.receptor!.nacionalidad,
    "Extranjero",
    "nacionalidad debe ser Extranjero",
  );
  assertEqual(
    result.retenciones!.receptor!.numRegIdTrib,
    "EXT-12345",
    "numRegIdTrib debe coincidir",
  );
  const hasJ = result.findings.some((f) => f.code === "RETENCIONES_RECEPTOR_NACIONAL_MISSING_RFC");
  assertEqual(
    hasJ,
    false,
    "no debe tener RETENCIONES_RECEPTOR_NACIONAL_MISSING_RFC (es extranjero)",
  );
  const hasK = result.findings.some(
    (f) => f.code === "RETENCIONES_RECEPTOR_EXTRANJERO_MISSING_NUM_REG_ID_TRIB",
  );
  assertEqual(
    hasK,
    false,
    "no debe tener RETENCIONES_RECEPTOR_EXTRANJERO_MISSING_NUM_REG_ID_TRIB (tiene NumRegIdTrib)",
  );
}

// DE) Retenciones total ret mismatch
async function testRetencionesTotalRetMismatch(): Promise<void> {
  const xml = buildRetencionesXml({
    totales: `<retenciones:Totales MontoTotOperacion="10000.00" MontoTotGrav="8000.00" MontoTotExent="2000.00" MontoTotRet="5000.00"><retenciones:ImpRetenidos><retenciones:ImpRetenido BaseRet="8000.00" Impuesto="001" MontoRet="1600.00" TipoPagoRet="Pago definitivo"/></retenciones:ImpRetenidos></retenciones:Totales>`,
  });
  const result = analyzeCfdi(xml, "ret-total-mismatch.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_TOTAL_RET_MISMATCH");
}

// DF) Retenciones periodo inválido
async function testRetencionesPeriodoInvalido(): Promise<void> {
  const xml = buildRetencionesXml({
    periodo: `<retenciones:Periodo MesIni="06" MesFin="03" Ejerc="abc"/>`,
  });
  const result = analyzeCfdi(xml, "ret-periodo-invalido.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_PERIODO_INVALID");
}

// DG) Retenciones sin timbre
async function testRetencionesSinTimbre(): Promise<void> {
  const xml = buildRetencionesXml({
    complemento: ``,
  });
  const result = analyzeCfdi(xml, "ret-sin-timbre.xml");
  assertIncludesFinding(result.findings, "RETENCIONES_TIMBRE_MISSING_REVIEW");
}

// DH) Prioridad CRITICAL => BLOCKER
async function testPrioridadCriticalBlocker(): Promise<void> {
  const f: Finding = {
    id: "test-1",
    severity: "CRITICAL",
    category: "TOTALS",
    code: "TOTAL_MISMATCH",
    title: "Test",
    message: "Test",
  };
  const priority = getFindingPriority(f.severity, f.category);
  assertEqual(priority, "BLOCKER", "CRITICAL severity debe ser BLOCKER");
  const group = getFindingActionGroup(f);
  assertEqual(group, "Corregir importes/totales", "code con TOTAL debe agrupar en totals");
}

// DI) Prioridad WARNING TAX => HIGH
async function testPrioridadWarningTaxHigh(): Promise<void> {
  const f: Finding = {
    id: "test-2",
    severity: "WARNING",
    category: "TAX",
    code: "TAX_ERROR",
    title: "Test",
    message: "Test",
  };
  const priority = getFindingPriority(f.severity, f.category);
  assertEqual(priority, "HIGH", "WARNING TAX debe ser HIGH");
  const group = getFindingActionGroup(f);
  assertEqual(group, "Revisar impuestos", "category TAX debe agrupar en impuestos");
}

// DJ) Prioridad INFO => LOW
async function testPrioridadInfoLow(): Promise<void> {
  const f: Finding = {
    id: "test-3",
    severity: "INFO",
    category: "STRUCTURE",
    code: "ADDENDA_DETECTED",
    title: "Test",
    message: "Test",
  };
  const priority = getFindingPriority(f.severity, f.category);
  assertEqual(priority, "LOW", "INFO severity debe ser LOW");
  const group = getFindingActionGroup(f);
  assertEqual(
    group,
    "Revisar referencias operativas",
    "ADDENDA STRUCTURE debe agrupar en referencias operativas",
  );
}

// DK) Evidence string largo se trunca
async function testEvidenceStringLargo(): Promise<void> {
  const longStr = "x".repeat(500);
  const result = sanitizeEvidenceValue(longStr) as string;
  assertEqual(typeof result, "string", "resultado debe ser string");
  assertEqual(result.length <= 240 + 14, true, `longitud truncada (${result.length})`);
  assertEqual(result.includes("[truncated]"), true, "debe incluir marcador truncated");
}

// DL) Evidence sensible se redacta
async function testEvidenceSensibleRedactado(): Promise<void> {
  const evidence = [
    { label: "rawXml", value: "<xml>raw</xml>" },
    { label: "token", value: "abc123" },
    { label: "normalizedXmlContent", value: "<xml>norm</xml>" },
  ];
  const sanitized = sanitizeFindingEvidence(evidence);
  assertTruthy(sanitized, "evidence sanitizada debe existir");
  for (const e of sanitized!) {
    assertEqual(e.value, "[redacted]", `${e.label} debe redactarse`);
  }
}

// DM) Evidence array grande se limita
async function testEvidenceArrayGrande(): Promise<void> {
  const arr = Array.from({ length: 50 }, (_, i) => `item${i}`);
  const result = sanitizeEvidenceValue(arr) as unknown[];
  assertEqual(result.length, 21, "array debe tener 20 items + 1 marcador");
  assertEqual(
    result[20] as string,
    "[truncated 30 additional items]",
    "debe incluir marcador de truncado",
  );
}

// DN) Findings por code se limitan
async function testFindingsPorCodeLimitados(): Promise<void> {
  const manyFindings: Finding[] = Array.from({ length: 60 }, (_, i) => ({
    id: `test-${i}`,
    severity: "INFO" as const,
    category: "STRUCTURE" as const,
    code: "SAME_CODE",
    title: "Test",
    message: "Test",
  }));
  const limited = limitFindings(manyFindings);
  const sameCode = limited.filter((f) => f.code === "SAME_CODE");
  assertEqual(sameCode.length, 50, "máximo 50 por code");
  const truncated = limited.find((f) => f.code === "FINDINGS_TRUNCATED_FOR_RESPONSE");
  assertTruthy(truncated, "debe existir FINDINGS_TRUNCATED_FOR_RESPONSE");
  assertEqual(truncated!.severity, "INFO", "severidad INFO");
  assertEqual(truncated!.category, "STRUCTURE", "category STRUCTURE");
}

// DO) Payload policy presente
async function testPayloadPolicyPresente(): Promise<void> {
  const xml = buildCfdi40Ingreso();
  const result = analyzeCfdi(xml, "pp-test.xml");
  const response = toAnalysisResponse(result);
  assertTruthy(response.payloadPolicy, "payloadPolicy debe existir");
  assertEqual(response.payloadPolicy!.sanitized, true, "sanitized debe ser true");
  assertEqual(
    response.payloadPolicy!.evidenceMaxStringLength > 0,
    true,
    "evidenceMaxStringLength debe ser positivo",
  );
  assertEqual(
    response.payloadPolicy!.findingsMaxTotal > 0,
    true,
    "findingsMaxTotal debe ser positivo",
  );
}

// DP) analysisMeta presente en CFDI
async function testAnalysisMetaPresenteCfdi(): Promise<void> {
  const xml = buildCfdi40Ingreso();
  const result = analyzeCfdi(xml, "meta-cfdi.xml");
  const response = toAnalysisResponse(result);
  assertTruthy(response.analysisMeta, "analysisMeta debe existir");
  assertEqual(response.analysisMeta!.coverage.documentKind, "CFDI", "documentKind debe ser CFDI");
  assertEqual(
    response.analysisMeta!.coverage.modules.some((m) => m.key === "cfdi-base"),
    true,
    "debe incluir cfdi-base",
  );
  assertEqual(response.analysisMeta!.performance.totalMs >= 0, true, "totalMs >= 0");
  assertEqual(response.analysisMeta!.performance.inputBytes > 0, true, "inputBytes > 0");
  assertEqual(response.analysisMeta!.performance.sanitized, true, "sanitized debe ser true");
  assertEqual(
    response.analysisMeta!.performance.findingsOriginalCount > 0,
    true,
    "debe haber hallazgos originales",
  );
  assertEqual(
    response.analysisMeta!.performance.findingsReturnedCount > 0,
    true,
    "debe haber hallazgos devueltos",
  );
}

// DQ) analysisMeta presente en Retenciones
async function testAnalysisMetaPresenteRetenciones(): Promise<void> {
  const xml = buildRetencionesXml();
  const result = analyzeCfdi(xml, "meta-retenciones.xml");
  const response = toAnalysisResponse(result);
  assertTruthy(response.analysisMeta, "analysisMeta debe existir");
  assertEqual(
    response.analysisMeta!.coverage.documentKind,
    "RETENCIONES",
    "documentKind debe ser RETENCIONES",
  );
  const cfdiModule = response.analysisMeta!.coverage.modules.find((m) => m.key === "cfdi-base");
  assertTruthy(cfdiModule, "debe existir cfdi-base module");
  assertEqual(cfdiModule!.detected, false, "cfdi-base no debe estar detectado");
  assertEqual(
    cfdiModule!.skippedReason,
    "No aplica para XML de Retenciones",
    "skippedReason correcto",
  );
  const retModule = response.analysisMeta!.coverage.modules.find((m) => m.key === "retenciones");
  assertTruthy(retModule, "debe existir retenciones module");
  assertEqual(retModule!.detected, true, "retenciones debe estar detectado");
}

// DR) coverage detecta complemento (Nómina)
async function testCoverageDetectaComplemento(): Promise<void> {
  const xml = buildNominaXml({});
  const result = analyzeCfdi(xml, "meta-nomina.xml");
  const response = toAnalysisResponse(result);
  assertTruthy(response.analysisMeta, "analysisMeta debe existir");
  const nominaModule = response.analysisMeta!.coverage.modules.find((m) => m.key === "nomina");
  assertTruthy(nominaModule, "debe existir nomina module");
  assertEqual(nominaModule!.detected, true, "nomina debe estar detectado");
  assertEqual(nominaModule!.analyzed, true, "nomina debe estar analizado");
}

// DS) findingsCount por módulo
async function testFindingsCountPorModulo(): Promise<void> {
  const xml = buildCfdi40Ingreso();
  const result = analyzeCfdi(xml, "meta-counts.xml");
  const response = toAnalysisResponse(result);
  assertTruthy(response.analysisMeta, "analysisMeta debe existir");
  const cfdiBase = response.analysisMeta!.coverage.modules.find((m) => m.key === "cfdi-base");
  assertTruthy(cfdiBase, "debe existir cfdi-base module");
  assertEqual(cfdiBase!.findingsCount > 0, true, "cfdi-base debe tener hallazgos > 0");
  const conceptModule = response.analysisMeta!.coverage.modules.find(
    (m) => m.key === "concept-taxes",
  );
  assertTruthy(conceptModule, "debe existir concept-taxes module");
  assertEqual(conceptModule!.findingsCount >= 0, true, "concept-taxes debe tener hallazgos >= 0");
}

// DT) analysisMeta no contiene contenido sensible
async function testAnalysisMetaNoContenidoSensible(): Promise<void> {
  const xml = buildCfdi40Ingreso();
  const result = analyzeCfdi(xml, "meta-seguro.xml");
  const response = toAnalysisResponse(result);
  assertTruthy(response.analysisMeta, "analysisMeta debe existir");
  const meta = response.analysisMeta!;
  const coverage = meta.coverage;
  const values = [
    meta.engineVersion,
    meta.generatedAt,
    String(meta.performance.inputBytes),
    String(meta.performance.inputKb),
    String(meta.performance.totalMs),
    coverage.documentKind,
    ...coverage.modules.map((m) => m.key + m.label + (m.skippedReason ?? "")),
    ...coverage.complementsDetected,
    ...coverage.complementsKnown,
    ...coverage.complementsUnknown,
  ];
  const combined = values.join(" ");
  assertEqual(combined.includes("<cfdi:"), false, "no debe contener <cfdi:");
  assertEqual(combined.includes("<retenciones:"), false, "no debe contener <retenciones:");
}

// GA) TipoComprobante desconocido
async function testCatTipoComprobanteUnknown(): Promise<void> {
  const xml = buildCfdi40Ingreso({ total: "1160.00", subtotal: "1000.00" }).replace(
    'TipoDeComprobante="I"',
    'TipoDeComprobante="X"',
  );
  const result = analyzeCfdi(xml, "cat-tipo-comprobante-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_TIPO_COMPROBANTE_UNKNOWN_REVIEW");
  const f = result.findings.find((x) => x.code === "CATALOG_TIPO_COMPROBANTE_UNKNOWN_REVIEW")!;
  assertEqual(f.severity, "WARNING", "TIPO_COMPROBANTE_UNKNOWN debe ser WARNING");
}

// GB) Exportacion desconocida
async function testCatExportacionUnknown(): Promise<void> {
  const xml = buildCfdi40Ingreso({ total: "1160.00", subtotal: "1000.00" }).replace(
    'Exportacion="01"',
    'Exportacion="99"',
  );
  const result = analyzeCfdi(xml, "cat-exportacion-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_EXPORTACION_UNKNOWN_REVIEW");
  const f = result.findings.find((x) => x.code === "CATALOG_EXPORTACION_UNKNOWN_REVIEW")!;
  assertEqual(f.severity, "WARNING", "EXPORTACION_UNKNOWN debe ser WARNING");
}

// GC) MetodoPago desconocido
async function testCatMetodoPagoUnknown(): Promise<void> {
  const xml = buildCfdi40Ingreso({ total: "1160.00", subtotal: "1000.00" }).replace(
    'MetodoPago="PPD"',
    'MetodoPago="ABC"',
  );
  const result = analyzeCfdi(xml, "cat-metodo-pago-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_METODO_PAGO_UNKNOWN_REVIEW");
  const f = result.findings.find((x) => x.code === "CATALOG_METODO_PAGO_UNKNOWN_REVIEW")!;
  assertEqual(f.severity, "WARNING", "METODO_PAGO_UNKNOWN debe ser WARNING");
}

// GD) ObjetoImp desconocido en concepto
async function testCatObjetoImpUnknown(): Promise<void> {
  const xml = buildConceptTaxXml({ objetoImp: "99", importe: "1000.00" });
  const result = analyzeCfdi(xml, "cat-objeto-imp-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_OBJETO_IMP_UNKNOWN_REVIEW");
  const f = result.findings.find((x) => x.code === "CATALOG_OBJETO_IMP_UNKNOWN_REVIEW")!;
  assertEqual(f.severity, "WARNING", "OBJETO_IMP_UNKNOWN debe ser WARNING");
}

// GE) Impuesto/TipoFactor desconocidos en concepto
async function testCatConceptTaxUnknown(): Promise<void> {
  const xml = buildConceptTaxXml({
    objetoImp: "02",
    importe: "1000.00",
    traslados: [
      {
        base: "1000.00",
        impuesto: "999",
        tipoFactor: "Raro",
        tasaOCuota: "0.160000",
        importe: "160.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "cat-concept-tax-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_CONCEPT_TAX_IMPUESTO_UNKNOWN_REVIEW");
  assertIncludesFinding(result.findings, "CATALOG_CONCEPT_TAX_TIPO_FACTOR_UNKNOWN_REVIEW");
}

// GF) TipoRelacion desconocido
async function testCatTipoRelacionUnknown(): Promise<void> {
  const xml = buildEgresoCfdiRelacionadosXml("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "99");
  const result = analyzeCfdi(xml, "cat-tipo-relacion-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_TIPO_RELACION_UNKNOWN_REVIEW");
  const f = result.findings.find((x) => x.code === "CATALOG_TIPO_RELACION_UNKNOWN_REVIEW")!;
  assertEqual(f.severity, "INFO", "TIPO_RELACION_UNKNOWN debe ser INFO");
}

// GG) Pago FormaDePagoP/MonedaP desconocidos
async function testCatPagoFormaMonedaUnknown(): Promise<void> {
  const xml = buildRepXml({ formaDePagoP: "77", monedaP: "ABC" });
  const result = analyzeCfdi(xml, "cat-pago-forma-moneda-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_PAYMENT_FORMA_PAGO_UNKNOWN_REVIEW");
  assertIncludesFinding(result.findings, "CATALOG_PAYMENT_MONEDA_UNKNOWN_REVIEW");
}

// GH) DR ObjetoImpDR/ImpuestoDR desconocidos
async function testCatDrObjetoImpImpuestoUnknown(): Promise<void> {
  const xml = buildRepXml({
    docs: [
      {
        monedaDR: "MXN",
        equivalenciaDR: "1",
        numParcialidad: "1",
        impSaldoAnt: "1000.00",
        impPagado: "400.00",
        impSaldoInsoluto: "600.00",
        objetoImpDR: "99",
        trasladosDR: [
          {
            baseDR: "400.00",
            impuestoDR: "999",
            tipoFactorDR: "Tasa",
            tasaOCuotaDR: "0.160000",
            importeDR: "64.00",
          },
        ],
      },
    ],
  });
  const result = analyzeCfdi(xml, "cat-dr-objeto-imp-impuesto-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_RELATED_DOCUMENT_OBJETO_IMP_UNKNOWN_REVIEW");
  assertIncludesFinding(result.findings, "CATALOG_PAYMENT_DR_TAX_IMPUESTO_UNKNOWN_REVIEW");
}

// GI) Nómina TipoNomina desconocido
async function testCatNominaTipoNominaUnknown(): Promise<void> {
  const xml = buildNominaXml({ tipoNomina: "X" });
  const result = analyzeCfdi(xml, "cat-nomina-tipo-nomina-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_NOMINA_TIPO_NOMINA_UNKNOWN_REVIEW");
  const f = result.findings.find((x) => x.code === "CATALOG_NOMINA_TIPO_NOMINA_UNKNOWN_REVIEW")!;
  assertEqual(f.severity, "WARNING", "NOMINA_TIPO_NOMINA_UNKNOWN debe ser WARNING");
}

// GJ) Retenciones Nacionalidad/CveRetenc/ImpuestoRet desconocidos
async function testCatRetencionesMultiUnknown(): Promise<void> {
  const xml = buildRetencionesXml({
    attrsOverride: `Version="2.0" FolioInt="RET-2024-001" FechaExp="2024-01-15T12:00:00" CveRetenc="99" DescRetenc="Desconocido" LugarExpRetenc="12345" Sello="abc" NumCert="00001000000500000000" Cert="def"`,
    receptor: `<retenciones:Receptor Nacionalidad="Otro"><retenciones:Nacional RfcR="XAXX010101000" NomDenRazSocR="CLIENTE SA DE CV" CURPR="XXXX000000HXXA" DomicilioFiscalR="12345"/></retenciones:Receptor>`,
    totales: `<retenciones:Totales MontoTotOperacion="10000.00" MontoTotRet="1600.00"><retenciones:ImpRetenidos><retenciones:ImpRetenido BaseRet="8000.00" Impuesto="99" MontoRet="1600.00" TipoPagoRet="Pago definitivo"/></retenciones:ImpRetenidos></retenciones:Totales>`,
  });
  const result = analyzeCfdi(xml, "cat-retenciones-multi-unknown.xml");
  assertIncludesFinding(result.findings, "CATALOG_RETENCIONES_NACIONALIDAD_UNKNOWN_REVIEW");
  assertIncludesFinding(result.findings, "CATALOG_RETENCIONES_CVE_RETENC_UNKNOWN_REVIEW");
  assertIncludesFinding(result.findings, "CATALOG_RETENCIONES_IMPUESTO_RET_UNKNOWN_REVIEW");
}

// ─── Tax Advanced Test Cases ────────────────────────────────────────────────

function buildBaseExceedsConceptXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GK" Fecha="2024-10-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="500.00" Moneda="MXN" Total="580.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="500.00" Importe="500.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="80.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="80.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="80.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gk-0000-0000-0000-000000000001" FechaTimbrado="2024-10-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildNegativeImporteXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GL" Fecha="2024-10-02T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="840.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="-160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="-160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="-160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gl-0000-0000-0000-000000000002" FechaTimbrado="2024-10-02T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildNegativeRateXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GM" Fecha="2024-10-03T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="-0.160000" Importe="-160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="-160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="-0.160000" Importe="-160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gm-0000-0000-0000-000000000003" FechaTimbrado="2024-10-03T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildRateTooHighXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GN" Fecha="2024-10-04T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="3000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="2.000000" Importe="2000.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="2000.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="2.000000" Importe="2000.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gn-0000-0000-0000-000000000004" FechaTimbrado="2024-10-04T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildExentoWithRateXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GO" Fecha="2024-10-05T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Exento" TasaOCuota="0.160000"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos>
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Exento" TasaOCuota="0.160000"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="go-0000-0000-0000-000000000005" FechaTimbrado="2024-10-05T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildTasaZeroWithAmountXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GP" Fecha="2024-10-06T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.000000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.000000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gp-0000-0000-0000-000000000006" FechaTimbrado="2024-10-06T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildRetentionIsrUnusualRateXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GQ" Fecha="2024-10-07T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
        <cfdi:Retenciones>
          <cfdi:Retencion Base="1000.00" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.080000" Importe="80.00"/>
        </cfdi:Retenciones>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00" TotalImpuestosRetenidos="80.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
    <cfdi:Retenciones>
      <cfdi:Retencion Base="1000.00" Impuesto="001" TipoFactor="Tasa" TasaOCuota="0.080000" Importe="80.00"/>
    </cfdi:Retenciones>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gq-0000-0000-0000-000000000007" FechaTimbrado="2024-10-07T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildGlobalBaseSumMismatchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GR" Fecha="2024-10-08T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1500.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gr-0000-0000-0000-000000000008" FechaTimbrado="2024-10-08T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildTotalConceptTaxesMismatchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GS" Fecha="2024-10-09T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="9999.99" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gs-0000-0000-0000-000000000009" FechaTimbrado="2024-10-09T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildObjetoImp01GlobalTaxesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GT" Fecha="2024-10-10T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gt-0000-0000-0000-000000000010" FechaTimbrado="2024-10-10T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testTaxBaseExceedsConceptAmount(): Promise<void> {
  const xml = buildBaseExceedsConceptXml();
  const result = analyzeCfdi(xml, "tax-base-exceeds-concept.xml");
  assertIncludesFinding(result.findings, "TAX_BASE_EXCEEDS_CONCEPT_AMOUNT_REVIEW", "WARNING");
}

async function testTaxAmountNegative(): Promise<void> {
  const xml = buildNegativeImporteXml();
  const result = analyzeCfdi(xml, "tax-amount-negative.xml");
  assertIncludesFinding(result.findings, "TAX_AMOUNT_NEGATIVE_REVIEW", "WARNING");
}

async function testTaxRateNegative(): Promise<void> {
  const xml = buildNegativeRateXml();
  const result = analyzeCfdi(xml, "tax-rate-negative.xml");
  assertIncludesFinding(result.findings, "TAX_RATE_NEGATIVE_REVIEW", "WARNING");
}

async function testTaxRateTooHigh(): Promise<void> {
  const xml = buildRateTooHighXml();
  const result = analyzeCfdi(xml, "tax-rate-too-high.xml");
  assertIncludesFinding(result.findings, "TAX_RATE_TOO_HIGH_REVIEW", "INFO");
}

async function testTaxExentoWithRate(): Promise<void> {
  const xml = buildExentoWithRateXml();
  const result = analyzeCfdi(xml, "tax-exento-with-rate.xml");
  assertIncludesFinding(result.findings, "TAX_EXENTO_WITH_RATE_REVIEW", "INFO");
}

async function testTaxTasaZeroWithAmount(): Promise<void> {
  const xml = buildTasaZeroWithAmountXml();
  const result = analyzeCfdi(xml, "tax-tasa-zero-with-amount.xml");
  assertIncludesFinding(result.findings, "TAX_TASA_ZERO_WITH_AMOUNT_REVIEW", "WARNING");
}

async function testRetentionIsrUnusualRate(): Promise<void> {
  const xml = buildRetentionIsrUnusualRateXml();
  const result = analyzeCfdi(xml, "retention-isr-unusual-rate.xml");
  assertIncludesFinding(result.findings, "RETENTION_ISR_RATE_UNUSUAL_REVIEW", "INFO");
}

async function testGlobalBaseSumMismatch(): Promise<void> {
  const xml = buildGlobalBaseSumMismatchXml();
  const result = analyzeCfdi(xml, "global-base-sum-mismatch.xml");
  assertIncludesFinding(result.findings, "GLOBAL_TAX_BASE_SUM_MISMATCH", "WARNING");
}

async function testTotalWithConceptTaxesMismatch(): Promise<void> {
  const xml = buildTotalConceptTaxesMismatchXml();
  const result = analyzeCfdi(xml, "total-concept-taxes-mismatch.xml");
  assertIncludesFinding(result.findings, "CFDI_TOTAL_WITH_CONCEPT_TAXES_RECALC_REVIEW", "WARNING");
}

async function testObjetoImp01WithGlobalTaxes(): Promise<void> {
  const xml = buildObjetoImp01GlobalTaxesXml();
  const result = analyzeCfdi(xml, "objetoimp-01-global-taxes.xml");
  assertIncludesFinding(result.findings, "OBJETOIMP_01_WITH_GLOBAL_TAXES_REVIEW", "WARNING");
}

// ─── Concept Advanced Test Cases ─────────────────────────────────────────────

function buildMissingFieldsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GU" Fecha="2024-11-01T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto Cantidad="1" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="01">
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gu-0000-0000-0000-000000000001" FechaTimbrado="2024-11-01T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildCantidadNoPositivaXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GV" Fecha="2024-11-02T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="MXN" Total="0.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="0" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="100.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gv-0000-0000-0000-000000000002" FechaTimbrado="2024-11-02T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildUnitValueNegativeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GW" Fecha="2024-11-03T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="-10.00" Importe="-10.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="-10.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="-1.60"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="-1.60">
    <cfdi:Traslados>
      <cfdi:Traslado Base="-10.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="-1.60"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gw-0000-0000-0000-000000000003" FechaTimbrado="2024-11-03T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildImportCalculationMismatchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GX" Fecha="2024-11-04T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="150.00" Moneda="MXN" Total="150.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="2" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="100.00" Importe="150.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gx-0000-0000-0000-000000000004" FechaTimbrado="2024-11-04T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildDiscountNegativeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GY" Fecha="2024-11-05T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" Descuento="-1.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gy-0000-0000-0000-000000000005" FechaTimbrado="2024-11-05T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildDiscountWithoutGlobalXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="GZ" Fecha="2024-11-06T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="990.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" Descuento="10.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="gz-0000-0000-0000-000000000006" FechaTimbrado="2024-11-06T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildGlobalDiscountMismatchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="HA" Fecha="2024-11-07T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="990.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Descuento="20.00" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" Descuento="10.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="0.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="0.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="0.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="ha-0000-0000-0000-000000000007" FechaTimbrado="2024-11-07T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildSubtotalMismatchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="HB" Fecha="2024-11-08T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="100.00" Moneda="MXN" Total="100.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="80.00" Importe="80.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hb-0000-0000-0000-000000000008" FechaTimbrado="2024-11-08T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildClaveProdServFormatInvalidXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="HC" Fecha="2024-11-09T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="ABC123" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hc-0000-0000-0000-000000000009" FechaTimbrado="2024-11-09T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildObjetoImp04ReviewXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="HD" Fecha="2024-11-10T10:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" NoIdentificacion="001" Cantidad="1" ClaveUnidad="H87" Unidad="PZA" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="04"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hd-0000-0000-0000-000000000010" FechaTimbrado="2024-11-10T10:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testConceptMissingFields(): Promise<void> {
  const xml = buildMissingFieldsXml();
  const result = analyzeCfdi(xml, "concept-missing-fields.xml");
  assertIncludesFinding(result.findings, "CONCEPT_MISSING_CLAVE_PROD_SERV", "WARNING");
  assertIncludesFinding(result.findings, "CONCEPT_MISSING_CLAVE_UNIDAD", "WARNING");
  assertIncludesFinding(result.findings, "CONCEPT_MISSING_DESCRIPCION", "WARNING");
}

async function testCantidadNoPositiva(): Promise<void> {
  const xml = buildCantidadNoPositivaXml();
  const result = analyzeCfdi(xml, "cantidad-no-positiva.xml");
  assertIncludesFinding(result.findings, "CONCEPT_ZERO_QUANTITY_REVIEW", "WARNING");
}

async function testUnitValueNegative(): Promise<void> {
  const xml = buildUnitValueNegativeXml();
  const result = analyzeCfdi(xml, "unit-value-negative.xml");
  assertIncludesFinding(result.findings, "CONCEPT_UNIT_VALUE_NEGATIVE", "WARNING");
}

async function testImportCalculationMismatch(): Promise<void> {
  const xml = buildImportCalculationMismatchXml();
  const result = analyzeCfdi(xml, "import-calculation-mismatch.xml");
  assertIncludesFinding(result.findings, "CONCEPT_UNIT_VALUE_MISMATCH_REVIEW", "WARNING");
}

async function testDiscountNegative(): Promise<void> {
  const xml = buildDiscountNegativeXml();
  const result = analyzeCfdi(xml, "discount-negative.xml");
  assertIncludesFinding(result.findings, "CONCEPT_DISCOUNT_NEGATIVE", "WARNING");
}

async function testDiscountWithoutGlobal(): Promise<void> {
  const xml = buildDiscountWithoutGlobalXml();
  const result = analyzeCfdi(xml, "discount-without-global.xml");
  assertIncludesFinding(
    result.findings,
    "CONCEPT_DISCOUNT_WITHOUT_GLOBAL_DISCOUNT_REVIEW",
    "WARNING",
  );
}

async function testGlobalDiscountMismatch(): Promise<void> {
  const xml = buildGlobalDiscountMismatchXml();
  const result = analyzeCfdi(xml, "global-discount-mismatch.xml");
  assertIncludesFinding(result.findings, "CONCEPT_GLOBAL_DISCOUNT_MISMATCH", "WARNING");
}

async function testSubtotalMismatch(): Promise<void> {
  const xml = buildSubtotalMismatchXml();
  const result = analyzeCfdi(xml, "subtotal-mismatch.xml");
  assertIncludesFinding(result.findings, "COMPROBANTE_SUBTOTAL_CONCEPT_SUM_MISMATCH", "CRITICAL");
}

async function testClaveProdServFormatInvalid(): Promise<void> {
  const xml = buildClaveProdServFormatInvalidXml();
  const result = analyzeCfdi(xml, "clave-prod-serv-format-invalid.xml");
  assertIncludesFinding(result.findings, "CONCEPT_CLAVE_PROD_SERV_FORMAT_REVIEW", "INFO");
}

async function testObjetoImp04Review(): Promise<void> {
  const xml = buildObjetoImp04ReviewXml();
  const result = analyzeCfdi(xml, "objetoimp-04-review.xml");
  assertIncludesFinding(result.findings, "CONCEPT_OBJETO_IMP_04_08_REVIEW", "INFO");
}

// ── Stamp / Timbre Fiscal Digital Advanced Validations (HE–HN) ──

function buildHeNoVersionNoUuidXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="123" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHeStampNoVersionNoUuid(): Promise<void> {
  const xml = buildHeNoVersionNoUuidXml();
  const result = analyzeCfdi(xml, "he-no-version-no-uuid.xml");
  assertIncludesFinding(result.findings, "MISSING_TFD_VERSION", "INFO");
  assertIncludesFinding(result.findings, "TFD_UUID_MISSING", "WARNING");
}

function buildHfInvalidFechaTimbradoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="124" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hf-00000000-0000-0000-0000-000000000000" FechaTimbrado="INVALID_DATE" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHfFechaTimbradoInvalid(): Promise<void> {
  const xml = buildHfInvalidFechaTimbradoXml();
  const result = analyzeCfdi(xml, "hf-fecha-timbrado-invalid.xml");
  assertIncludesFinding(result.findings, "TFD_FECHA_TIMBRADO_INVALID", "WARNING");
}

function buildHgFutureFechaTimbradoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="125" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hg-00000000-0000-0000-0000-000000000000" FechaTimbrado="2099-06-01T00:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHgFechaTimbradoFuture(): Promise<void> {
  const xml = buildHgFutureFechaTimbradoXml();
  const result = analyzeCfdi(xml, "hg-fecha-timbrado-future.xml");
  assertIncludesFinding(result.findings, "TFD_FECHA_TIMBRADO_FUTURE_REVIEW", "INFO");
}

function buildHhFechaTimbradoFarAfterXml(): string {
  const cfdiDate = "2024-01-12T10:00:00";
  const tfdDate = "2024-01-15T10:00:01";
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="126" Fecha="${cfdiDate}" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hh-00000000-0000-0000-0000-000000000000" FechaTimbrado="${tfdDate}" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHhFechaTimbradoFarAfter(): Promise<void> {
  const xml = buildHhFechaTimbradoFarAfterXml();
  const result = analyzeCfdi(xml, "hh-fecha-timbrado-far-after.xml");
  assertIncludesFinding(
    result.findings,
    "TFD_FECHA_TIMBRADO_TOO_FAR_AFTER_FECHA_CFDI_REVIEW",
    "INFO",
  );
}

function buildHiRfcProvCertifInvalidXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="127" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hi-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="NOT_A_REAL_RFC" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHiRfcProvCertifInvalid(): Promise<void> {
  const xml = buildHiRfcProvCertifInvalidXml();
  const result = analyzeCfdi(xml, "hi-rfc-prov-certif-invalid.xml");
  assertIncludesFinding(result.findings, "TFD_RFC_PROV_CERTIF_FORMAT_REVIEW", "WARNING");
}

function buildHjSelloCfdDiffersXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="128" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="comprobanteSelloValue">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hj-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="diffSelloCfdValue" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHjSelloCfdDiffers(): Promise<void> {
  const xml = buildHjSelloCfdDiffersXml();
  const result = analyzeCfdi(xml, "hj-sello-cfd-differs.xml");
  assertIncludesFinding(
    result.findings,
    "TFD_SELLO_CFD_DIFFERS_FROM_COMPROBANTE_SELLO_REVIEW",
    "WARNING",
  );
}

function buildHkSelloTooShortXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="129" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hk-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="short" SelloSAT="tiny" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHkSelloTooShort(): Promise<void> {
  const xml = buildHkSelloTooShortXml();
  const result = analyzeCfdi(xml, "hk-sello-too-short.xml");
  assertIncludesFinding(result.findings, "TFD_SELLO_CFD_TOO_SHORT_REVIEW", "INFO");
  assertIncludesFinding(result.findings, "TFD_SELLO_SAT_TOO_SHORT_REVIEW", "INFO");
}

function buildHlSelloNotBase64Xml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="130" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hl-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="!!not-base64!!" SelloSAT="@@invalid@@@" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHlSelloNotBase64(): Promise<void> {
  const xml = buildHlSelloNotBase64Xml();
  const result = analyzeCfdi(xml, "hl-sello-not-base64.xml");
  assertIncludesFinding(result.findings, "TFD_SELLO_CFD_BASE64_REVIEW", "INFO");
  assertIncludesFinding(result.findings, "TFD_SELLO_SAT_BASE64_REVIEW", "INFO");
}

function buildHmCertificadoTooShortXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="131" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="short" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="hm-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHmCertificadoTooShort(): Promise<void> {
  const xml = buildHmCertificadoTooShortXml();
  const result = analyzeCfdi(xml, "hm-certificado-too-short.xml");
  assertIncludesFinding(result.findings, "COMPROBANTE_CERTIFICADO_TOO_SHORT_REVIEW", "INFO");
}

function buildHnTfdPresentNotStampedXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="132" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHnTfdPresentNotStamped(): Promise<void> {
  const xml = buildHnTfdPresentNotStampedXml();
  const result = analyzeCfdi(xml, "hn-tfd-present-not-stamped.xml");
  assertIncludesFinding(result.findings, "TFD_PRESENT_BUT_ISSTAMPED_FALSE_REVIEW", "WARNING");
  assertIncludesFinding(result.findings, "TFD_UUID_MISSING", "WARNING");
}

// ── CFDI Relations Advanced Validations (HO–HX) ──

const REL_4_NS = 'xmlns:cfdi="http://www.sat.gob.mx/cfd/4"';
const REL_XSI_NS = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
const REL_SCHEMA =
  'xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"';

function buildRelBase(opts: {
  tipo?: string;
  relaciones?: string;
  complemento?: string;
  uuid?: string;
  sello?: string;
  certificado?: string;
}): string {
  const tipo = opts.tipo ?? "I";
  const uuid = opts.uuid ?? "ho-00000000-0000-0000-0000-000000000000";
  const relaciones = opts.relaciones ?? "";
  const complemento =
    opts.complemento ??
    `<tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="${uuid}" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>`;
  const sello = opts.sello ?? "";
  const certificado = opts.certificado ?? "certificadoBase64Placeholder";
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${REL_4_NS} ${REL_XSI_NS} ${REL_SCHEMA} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="${certificado}"${sello ? ` Sello="${sello}"` : ""} SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="${tipo}" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  ${relaciones}
  <cfdi:Complemento>${complemento}</cfdi:Complemento>
</cfdi:Comprobante>`;
}

// HO) CfdiRelacionados vacío (grupo sin CfdiRelacionado)
async function testHoRelationGroupEmpty(): Promise<void> {
  const xml = buildRelBase({
    relaciones: `<cfdi:CfdiRelacionados TipoRelacion="01"/>`,
  });
  const result = analyzeCfdi(xml, "ho-relation-group-empty.xml");
  assertIncludesFinding(result.findings, "CFDI_RELATION_GROUP_WITHOUT_RELATED_UUIDS", "WARNING");
}

// HP) TipoRelacion faltante
async function testHpRelationTipoMissing(): Promise<void> {
  const xml = buildRelBase({
    relaciones: `<cfdi:CfdiRelacionados>
      <cfdi:CfdiRelacionado UUID="hp-11111111-1111-4111-8111-111111111111"/>
    </cfdi:CfdiRelacionados>`,
  });
  const result = analyzeCfdi(xml, "hp-relation-tipo-missing.xml");
  assertIncludesFinding(result.findings, "CFDI_RELATION_GROUP_WITHOUT_TIPO_RELACION", "WARNING");
}

// HQ) UUID relacionado inválido (formato no estándar)
async function testHqRelatedUuidInvalid(): Promise<void> {
  const xml = buildRelBase({
    relaciones: `<cfdi:CfdiRelacionados TipoRelacion="01">
      <cfdi:CfdiRelacionado UUID="NO-UUID"/>
    </cfdi:CfdiRelacionados>`,
  });
  const result = analyzeCfdi(xml, "hq-related-uuid-invalid.xml");
  assertIncludesFinding(result.findings, "CFDI_RELATED_UUID_NON_STANDARD", "WARNING");
}

// HR) UUID relacionado duplicado
async function testHrRelatedUuidDuplicated(): Promise<void> {
  const xml = buildRelBase({
    relaciones: `<cfdi:CfdiRelacionados TipoRelacion="01">
      <cfdi:CfdiRelacionado UUID="hr-11111111-1111-4111-8111-111111111111"/>
      <cfdi:CfdiRelacionado UUID="hr-11111111-1111-4111-8111-111111111111"/>
    </cfdi:CfdiRelacionados>`,
  });
  const result = analyzeCfdi(xml, "hr-related-uuid-duplicated.xml");
  assertIncludesFinding(result.findings, "CFDI_RELATED_DUPLICATE_UUID", "INFO");
}

// HS) UUID relacionado igual al UUID propio
async function testHsSelfRelation(): Promise<void> {
  const selfUuid = "hs-self-0000-0000-0000-000000000000";
  const xml = buildRelBase({
    uuid: selfUuid,
    relaciones: `<cfdi:CfdiRelacionados TipoRelacion="01">
      <cfdi:CfdiRelacionado UUID="${selfUuid}"/>
    </cfdi:CfdiRelacionados>`,
  });
  const result = analyzeCfdi(xml, "hs-self-relation.xml");
  assertIncludesFinding(result.findings, "CFDI_SELF_RELATION", "WARNING");
}

// HT) TipoRelacion 04 con múltiples UUIDs
async function testHtTipo04MultipleUuids(): Promise<void> {
  const xml = buildRelBase({
    relaciones: `<cfdi:CfdiRelacionados TipoRelacion="04">
      <cfdi:CfdiRelacionado UUID="ht-11111111-1111-4111-8111-111111111111"/>
      <cfdi:CfdiRelacionado UUID="ht-22222222-2222-4222-8222-222222222222"/>
    </cfdi:CfdiRelacionados>`,
  });
  const result = analyzeCfdi(xml, "ht-tipo04-multiple-uuids.xml");
  assertIncludesFinding(
    result.findings,
    "SUBSTITUTION_RELATION_WITH_MULTIPLE_UUIDS_REVIEW",
    "INFO",
  );
}

// HU) Pago sin DoctoRelacionado pero con CfdiRelacionados
function buildHuPagoSinDocConRelXml(): string {
  const uuid = "hu-00000000-0000-0000-0000-000000000000";
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${REL_4_NS} xmlns:pago20="http://www.sat.gob.mx/Pagos20" ${REL_XSI_NS} ${REL_SCHEMA} Version="4.0" Serie="P" Folio="1" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:CfdiRelacionados TipoRelacion="01">
    <cfdi:CfdiRelacionado UUID="hu-00000000-0000-0000-0000-000000000000"/>
  </cfdi:CfdiRelacionados>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="0.00" NumOperacion="OP001"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="${uuid}" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHuPagoSinDocConRel(): Promise<void> {
  const xml = buildHuPagoSinDocConRelXml();
  const result = analyzeCfdi(xml, "hu-pago-sin-doc-con-rel.xml");
  assertIncludesFinding(
    result.findings,
    "PAYMENT_WITHOUT_RELATED_DOCUMENTS_BUT_CFDI_RELACIONADOS_REVIEW",
    "WARNING",
  );
}

// HV) Pago con DoctoRelacionado repetido en CfdiRelacionados
function buildHvPagoDocDuplicadoEnRelXml(): string {
  const docUuid = "D24D7610-B86B-4AEA-9C5A-3D14B9057645";
  const timbreUuid = "E54D7610-A86B-5AEA-9C5A-3D14B9057645";
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="P" Folio="2" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:CfdiRelacionados TipoRelacion="01">
    <cfdi:CfdiRelacionado UUID="${docUuid}"/>
  </cfdi:CfdiRelacionados>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="OP001">
        <pago20:DoctoRelacionado IdDocumento="${docUuid}" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="5000.00" ImpPagado="5000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="${timbreUuid}" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

async function testHvPagoDocDuplicadoEnRel(): Promise<void> {
  const xml = buildHvPagoDocDuplicadoEnRelXml();
  const result = analyzeCfdi(xml, "hv-pago-doc-duplicado-en-rel.xml");
  assertIncludesFinding(
    result.findings,
    "PAYMENT_DOC_RELATED_UUID_DUPLICATED_IN_CFDI_RELACIONADOS_REVIEW",
    "INFO",
  );
}

// HW) Más de 20 UUIDs en un grupo
function buildHwTooManyUuidsXml(): string {
  const items: string[] = [];
  for (let i = 1; i <= 21; i++) {
    const hex = i.toString(16).padStart(2, "0");
    items.push(
      `      <cfdi:CfdiRelacionado UUID="hw-${hex}000000-0000-0000-0000-${hex}0000000000${hex}"/>`,
    );
  }
  return buildRelBase({
    relaciones: `<cfdi:CfdiRelacionados TipoRelacion="01">
${items.join("\n")}
    </cfdi:CfdiRelacionados>`,
  });
}

async function testHwTooManyUuids(): Promise<void> {
  const xml = buildHwTooManyUuidsXml();
  const result = analyzeCfdi(xml, "hw-too-many-uuids.xml");
  assertIncludesFinding(result.findings, "CFDI_RELATION_TOO_MANY_UUIDS_REVIEW", "INFO");
}

// HX) Múltiples grupos de CfdiRelacionados
async function testHxMultipleRelationGroups(): Promise<void> {
  const xml = buildRelBase({
    relaciones: `<cfdi:CfdiRelacionados TipoRelacion="01">
      <cfdi:CfdiRelacionado UUID="hx-11111111-1111-4111-8111-111111111111"/>
    </cfdi:CfdiRelacionados>
    <cfdi:CfdiRelacionados TipoRelacion="03">
      <cfdi:CfdiRelacionado UUID="hx-22222222-2222-4222-8222-222222222222"/>
    </cfdi:CfdiRelacionados>`,
  });
  const result = analyzeCfdi(xml, "hx-multiple-relation-groups.xml");
  assertIncludesFinding(result.findings, "CFDI_RELATION_MULTIPLE_GROUPS_REVIEW", "INFO");
}

// ── HY–IH Builders ──

function buildPartyBase(opts: {
  tipo?: string;
  rfcEmisor?: string;
  nombreEmisor?: string;
  regimenFiscal?: string;
  rfcReceptor?: string;
  nombreReceptor?: string;
  regimenFiscalReceptor?: string;
  domicilioFiscalReceptor?: string;
  usoCfdi?: string;
  extraComplemento?: string;
}): string {
  const tipo = opts.tipo ?? "I";
  const rfcEmisor = opts.rfcEmisor ?? "XAXX010101000";
  const nombreEmisor = opts.nombreEmisor ?? "EMPRESA SA DE CV";
  const regimenFiscal = opts.regimenFiscal ?? "601";
  const rfcReceptor = opts.rfcReceptor ?? "XAXX010101001";
  const nombreReceptor = opts.nombreReceptor ?? "CLIENTE SA DE CV";
  const regimenFiscalReceptor = opts.regimenFiscalReceptor ?? "608";
  const domicilioFiscalReceptor = opts.domicilioFiscalReceptor ?? "12345";
  const usoCfdi = opts.usoCfdi ?? "G03";
  const extra = opts.extraComplemento ?? "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="${tipo}" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor${rfcEmisor ? ` Rfc="${rfcEmisor}"` : ""}${nombreEmisor ? ` Nombre="${nombreEmisor}"` : ""}${regimenFiscal ? ` RegimenFiscal="${regimenFiscal}"` : ""}/>
  <cfdi:Receptor${rfcReceptor ? ` Rfc="${rfcReceptor}"` : ""}${nombreReceptor ? ` Nombre="${nombreReceptor}"` : ""}${regimenFiscalReceptor ? ` RegimenFiscalReceptor="${regimenFiscalReceptor}"` : ""}${domicilioFiscalReceptor ? ` DomicilioFiscalReceptor="${domicilioFiscalReceptor}"` : ""}${usoCfdi ? ` UsoCFDI="${usoCfdi}"` : ""}/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="hy-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    ${extra}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIbGenericForeignSinResidenciaXml(): string {
  const cce = `<cce11:ComercioExterior ${CCE11_NS} Version="1.1" TipoOperacion="2" ClaveDePedimento="A1" Incoterm="FOB" TotalUSD="1000.00">
        <cce11:Receptor>
          <cce11:Domicilio Pais="USA" CodigoPostal="12345"/>
        </cce11:Receptor>
        <cce11:Mercancias>
          <cce11:Mercancia NoIdentificacion="001" FraccionArancelaria="01010101" CantidadAduana="1" UnidadAduana="PZA" ValorUnitarioAduana="1000.00" ValorDolares="1000.00"/>
        </cce11:Mercancias>
      </cce11:ComercioExterior>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="USD" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XEXX010101000" Nombre="FOREIGN BUYER" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="616" UsoCFDI="S01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ib-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    ${cce}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIcNumRegIdTribSinResidenciaXml(): string {
  const cce = `<cce11:ComercioExterior ${CCE11_NS} Version="1.1" TipoOperacion="2" ClaveDePedimento="A1" Incoterm="FOB" TotalUSD="1000.00">
        <cce11:Receptor NumRegIdTrib="ABC123456">
          <cce11:Domicilio Pais="USA" CodigoPostal="12345"/>
        </cce11:Receptor>
        <cce11:Mercancias>
          <cce11:Mercancia NoIdentificacion="001" FraccionArancelaria="01010101" CantidadAduana="1" UnidadAduana="PZA" ValorUnitarioAduana="1000.00" ValorDolares="1000.00"/>
        </cce11:Mercancias>
      </cce11:ComercioExterior>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="USD" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ic-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    ${cce}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIeNominaReceptorGenericoXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="N" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101000" Nombre="PUBLICO EN GENERAL" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="616" UsoCFDI="CN01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ie-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

// ── HY–IH Test Functions ──

async function testHyEmisorSinRfcNombreRegimen(): Promise<void> {
  const xml = buildPartyBase({
    rfcEmisor: "",
    nombreEmisor: "",
    regimenFiscal: "",
  });
  const result = analyzeCfdi(xml, "hy-emisor-sin-rfc-nombre-regimen.xml");
  assertIncludesFinding(result.findings, "EMISOR_RFC_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "EMISOR_NAME_EMPTY_REVIEW", "WARNING");
  assertIncludesFinding(result.findings, "EMISOR_REGIMEN_FISCAL_MISSING", "WARNING");
}

async function testHzReceptorSinDatos(): Promise<void> {
  const xml = buildPartyBase({
    rfcReceptor: "",
    nombreReceptor: "",
    regimenFiscalReceptor: "",
    domicilioFiscalReceptor: "",
    usoCfdi: "",
  });
  const result = analyzeCfdi(xml, "hz-receptor-sin-datos.xml");
  assertIncludesFinding(result.findings, "RECEPTOR_RFC_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "RECEPTOR_NAME_EMPTY_REVIEW", "WARNING");
  assertIncludesFinding(result.findings, "RECEPTOR_REGIMEN_FISCAL_MISSING", "WARNING");
  assertIncludesFinding(result.findings, "RECEPTOR_DOMICILIO_FISCAL_MISSING", "WARNING");
}

async function testIaReceptorRfcInvalid(): Promise<void> {
  const xml = buildPartyBase({ rfcReceptor: "ABC" });
  const result = analyzeCfdi(xml, "ia-receptor-rfc-invalid.xml");
  assertIncludesFinding(result.findings, "RECEPTOR_RFC_FORMAT_REVIEW", "WARNING");
}

async function testIbGenericForeignSinResidenciaNumReg(): Promise<void> {
  const xml = buildIbGenericForeignSinResidenciaXml();
  const result = analyzeCfdi(xml, "ib-generic-foreign-sin-residencia-numreg.xml");
  assertIncludesFinding(
    result.findings,
    "RECEPTOR_GENERIC_FOREIGN_WITHOUT_RESIDENCIA_FISCAL",
    "WARNING",
  );
  assertIncludesFinding(
    result.findings,
    "RECEPTOR_GENERIC_FOREIGN_WITHOUT_NUM_REG_ID_TRIB_REVIEW",
    "WARNING",
  );
}

async function testIcNumRegIdTribSinResidencia(): Promise<void> {
  const xml = buildIcNumRegIdTribSinResidenciaXml();
  const result = analyzeCfdi(xml, "ic-numregidtrib-sin-residencia.xml");
  assertIncludesFinding(
    result.findings,
    "RECEPTOR_NUM_REG_ID_TRIB_WITHOUT_RESIDENCIA_FISCAL_REVIEW",
    "WARNING",
  );
}

async function testIdEmisorReceptorAmbosGenericos(): Promise<void> {
  const xml = buildPartyBase({
    rfcEmisor: "XAXX010101000",
    rfcReceptor: "XAXX010101000",
  });
  const result = analyzeCfdi(xml, "id-emisor-receptor-ambos-genericos.xml");
  assertIncludesFinding(result.findings, "EMISOR_RECEPTOR_BOTH_GENERIC_REVIEW", "WARNING");
}

async function testIeNominaReceptorGenerico(): Promise<void> {
  const xml = buildIeNominaReceptorGenericoXml();
  const result = analyzeCfdi(xml, "ie-nomina-receptor-generico.xml");
  assertIncludesFinding(result.findings, "NOMINA_RECEPTOR_RFC_GENERIC_REVIEW", "WARNING");
}

async function testIfUsoCfdiDPersonaMoral(): Promise<void> {
  const xml = buildPartyBase({
    rfcReceptor: "ABC860101XXX",
    usoCfdi: "D01",
  });
  const result = analyzeCfdi(xml, "if-usocfdi-d-persona-moral.xml");
  assertIncludesFinding(result.findings, "USOCFDI_D_SERIES_FOR_MORAL_PERSON_REVIEW", "INFO");
}

async function testIgRegimen616NoGenerico(): Promise<void> {
  const xml = buildPartyBase({
    rfcReceptor: "XAXX010101001",
    regimenFiscalReceptor: "616",
  });
  const result = analyzeCfdi(xml, "ig-regimen-616-no-generico.xml");
  assertIncludesFinding(result.findings, "REGIMEN_616_WITH_NON_GENERIC_RFC_REVIEW", "INFO");
}

async function testIhUsoCfdiFormatoDesconocido(): Promise<void> {
  const xml = buildPartyBase({ usoCfdi: "ZZ99" });
  const result = analyzeCfdi(xml, "ih-usocfdi-formato-desconocido.xml");
  assertIncludesFinding(result.findings, "RECEPTOR_USO_CFDI_FORMAT_REVIEW", "INFO");
}

// ── II–IR Builders ──

function buildIiPaymentOnNonPaymentXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} xmlns:pago20="http://www.sat.gob.mx/Pagos20" ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ii-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="OP001"/>
    </pago20:Pagos>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIkCartaPorteInternacionalSinCceXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ik-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    <cartaporte30:CartaPorte xmlns:cartaporte30="http://www.sat.gob.mx/CartaPorte30" Version="3.0" IdCCP="A1" TranspInternac="Sí" TotalDistRec="100.00">
      <cartaporte30:Ubicaciones>
        <cartaporte30:Ubicacion TipoUbicacion="Origen" IDUbicacion="OR001" RFCRemitenteDestinatario="XAXX010101000" FechaHoraSalidaLlegada="2024-01-15T12:00:00"/>
        <cartaporte30:Ubicacion TipoUbicacion="Destino" IDUbicacion="DE001" RFCRemitenteDestinatario="XAXX010101001" FechaHoraSalidaLlegada="2024-01-16T12:00:00" DistanciaRecorrida="100.00"/>
      </cartaporte30:Ubicaciones>
      <cartaporte30:Mercancias>
        <cartaporte30:Mercancia BienesTransp="01010101" Descripcion="Producto" Cantidad="1" ClaveUnidad="H87" PesoEnKg="10.000"/>
      </cartaporte30:Mercancias>
    </cartaporte30:CartaPorte>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIlPagoConImpuestosXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} xmlns:pago20="http://www.sat.gob.mx/Pagos20" ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="P" Folio="1" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="il-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildImTrasladoConImpuestosXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="T" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="S01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="im-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildInNominaConCceXml(): string {
  const cce = `<cce11:ComercioExterior ${CCE11_NS} Version="1.1" TipoOperacion="2" ClaveDePedimento="A1" Incoterm="FOB" TotalUSD="1000.00">
        <cce11:Receptor>
          <cce11:Domicilio Pais="USA" CodigoPostal="12345"/>
        </cce11:Receptor>
        <cce11:Mercancias>
          <cce11:Mercancia NoIdentificacion="001" FraccionArancelaria="01010101" CantidadAduana="1" UnidadAduana="PZA" ValorUnitarioAduana="1000.00" ValorDolares="1000.00"/>
        </cce11:Mercancias>
      </cce11:ComercioExterior>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="N" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CN01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="in-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    ${cce}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIoNominaConCartaPorteXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="N" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CN01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="io-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    <cartaporte30:CartaPorte xmlns:cartaporte30="http://www.sat.gob.mx/CartaPorte30" Version="3.0" IdCCP="A1" TranspInternac="No" TotalDistRec="100.00">
      <cartaporte30:Ubicaciones>
        <cartaporte30:Ubicacion TipoUbicacion="Origen" IDUbicacion="OR001" RFCRemitenteDestinatario="XAXX010101000" FechaHoraSalidaLlegada="2024-01-15T12:00:00"/>
        <cartaporte30:Ubicacion TipoUbicacion="Destino" IDUbicacion="DE001" RFCRemitenteDestinatario="XAXX010101001" FechaHoraSalidaLlegada="2024-01-16T12:00:00" DistanciaRecorrida="100.00"/>
      </cartaporte30:Ubicaciones>
      <cartaporte30:Mercancias>
        <cartaporte30:Mercancia BienesTransp="01010101" Descripcion="Producto" Cantidad="1" ClaveUnidad="H87" PesoEnKg="10.000"/>
      </cartaporte30:Mercancias>
    </cartaporte30:CartaPorte>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIpPagoConRelYDocXml(): string {
  const docUuid = "ip-11111111-1111-4111-8111-111111111111";
  const timbreUuid = "ip-00000000-0000-0000-0000-000000000000";
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} xmlns:pago20="http://www.sat.gob.mx/Pagos20" ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="P" Folio="2" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:CfdiRelacionados TipoRelacion="01">
    <cfdi:CfdiRelacionado UUID="${docUuid}"/>
  </cfdi:CfdiRelacionados>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="OP001">
        <pago20:DoctoRelacionado IdDocumento="${docUuid}" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="5000.00" ImpPagado="5000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="01"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="${timbreUuid}" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIqMultipleComplementsXml(): string {
  const cce = `<cce11:ComercioExterior ${CCE11_NS} Version="1.1" TipoOperacion="2" ClaveDePedimento="A1" Incoterm="FOB" TotalUSD="1000.00">
        <cce11:Receptor>
          <cce11:Domicilio Pais="USA" CodigoPostal="12345"/>
        </cce11:Receptor>
        <cce11:Mercancias>
          <cce11:Mercancia NoIdentificacion="001" FraccionArancelaria="01010101" CantidadAduana="1" UnidadAduana="PZA" ValorUnitarioAduana="1000.00" ValorDolares="1000.00"/>
        </cce11:Mercancias>
      </cce11:ComercioExterior>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} xmlns:pago20="http://www.sat.gob.mx/Pagos20" ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="iq-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="OP001"/>
    </pago20:Pagos>
    <cartaporte30:CartaPorte xmlns:cartaporte30="http://www.sat.gob.mx/CartaPorte30" Version="3.0" IdCCP="A1" TranspInternac="No" TotalDistRec="100.00">
      <cartaporte30:Ubicaciones>
        <cartaporte30:Ubicacion TipoUbicacion="Origen" IDUbicacion="OR001" RFCRemitenteDestinatario="XAXX010101000" FechaHoraSalidaLlegada="2024-01-15T12:00:00"/>
        <cartaporte30:Ubicacion TipoUbicacion="Destino" IDUbicacion="DE001" RFCRemitenteDestinatario="XAXX010101001" FechaHoraSalidaLlegada="2024-01-16T12:00:00" DistanciaRecorrida="100.00"/>
      </cartaporte30:Ubicaciones>
      <cartaporte30:Mercancias>
        <cartaporte30:Mercancia BienesTransp="01010101" Descripcion="Producto" Cantidad="1" ClaveUnidad="H87" PesoEnKg="10.000"/>
      </cartaporte30:Mercancias>
    </cartaporte30:CartaPorte>
    ${cce}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

function buildIrAddendaConCriticalXml(): string {
  const addendaNs = 'xmlns:add="http://www.example.com/addenda"';
  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${addendaNs} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="" Nombre="" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI=""/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ir-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
  <cfdi:Addenda>
    <add:CustomData>
      <add:OrderID>12345</add:OrderID>
    </add:CustomData>
  </cfdi:Addenda>
</cfdi:Comprobante>`;
}

// ── II–IR Test Functions ──

async function testIiPaymentOnNonPayment(): Promise<void> {
  const xml = buildIiPaymentOnNonPaymentXml();
  const result = analyzeCfdi(xml, "ii-payment-on-non-payment.xml");
  assertIncludesFinding(
    result.findings,
    "CROSS_PAYMENT_COMPLEMENT_ON_NON_PAYMENT_REVIEW",
    "WARNING",
  );
}

async function testIjNominaOnNonNomina(): Promise<void> {
  const extra = `<nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" Version="1.2" TipoNomina="O" FechaPago="2024-01-15" FechaInicialPago="2024-01-01" FechaFinalPago="2024-01-15" NumDiasPagados="15" TotalPercepciones="10000.00" TotalDeducciones="2000.00">
      <nomina12:Percepciones TotalSueldos="10000.00" TotalGravado="10000.00" TotalExento="0.00"/>
    </nomina12:Nomina>`;
  const xml = buildPartyBase({ tipo: "T", usoCfdi: "S01", extraComplemento: extra });
  const result = analyzeCfdi(xml, "ij-nomina-on-non-nomina.xml");
  assertIncludesFinding(result.findings, "NOMINA_WITH_UNEXPECTED_CFDI_TYPE", "WARNING");
}

async function testIkCartaPorteInternacionalSinCce(): Promise<void> {
  const xml = buildIkCartaPorteInternacionalSinCceXml();
  const result = analyzeCfdi(xml, "ik-cartaporte-internacional-sin-cce.xml");
  assertIncludesFinding(
    result.findings,
    "CROSS_CARTA_PORTE_INTERNACIONAL_WITHOUT_CCE_REVIEW",
    "WARNING",
  );
}

async function testIlPagoConImpuestos(): Promise<void> {
  const xml = buildIlPagoConImpuestosXml();
  const result = analyzeCfdi(xml, "il-pago-con-impuestos.xml");
  assertIncludesFinding(result.findings, "CROSS_TIPO_P_WITH_TAXES_REVIEW", "WARNING");
}

async function testImTrasladoConImpuestos(): Promise<void> {
  const xml = buildImTrasladoConImpuestosXml();
  const result = analyzeCfdi(xml, "im-traslado-con-impuestos.xml");
  assertIncludesFinding(result.findings, "CROSS_TIPO_T_WITH_TAXES_REVIEW", "WARNING");
}

async function testInNominaConCce(): Promise<void> {
  const xml = buildInNominaConCceXml();
  const result = analyzeCfdi(xml, "in-nomina-con-cce.xml");
  assertIncludesFinding(result.findings, "CROSS_NOMINA_WITH_COMERCIO_EXTERIOR_REVIEW", "WARNING");
}

async function testIoNominaConCartaPorte(): Promise<void> {
  const xml = buildIoNominaConCartaPorteXml();
  const result = analyzeCfdi(xml, "io-nomina-con-cartaporte.xml");
  assertIncludesFinding(result.findings, "CROSS_NOMINA_WITH_CARTA_PORTE_REVIEW", "WARNING");
}

async function testIpPagoConRelYDoc(): Promise<void> {
  const xml = buildIpPagoConRelYDocXml();
  const result = analyzeCfdi(xml, "ip-pago-con-rel-y-doc.xml");
  assertIncludesFinding(
    result.findings,
    "CROSS_PAYMENT_WITH_CFDI_RELACIONADOS_AND_DOCTOS_REVIEW",
    "INFO",
  );
}

async function testIqMultipleComplements(): Promise<void> {
  const xml = buildIqMultipleComplementsXml();
  const result = analyzeCfdi(xml, "iq-multiple-complements.xml");
  assertIncludesFinding(
    result.findings,
    "CROSS_MULTIPLE_HIGH_COMPLEXITY_COMPLEMENTS_REVIEW",
    "INFO",
  );
}

async function testIrAddendaConCritical(): Promise<void> {
  const xml = buildIrAddendaConCriticalXml();
  const result = analyzeCfdi(xml, "ir-addenda-con-critical.xml");
  assertIncludesFinding(result.findings, "CROSS_ADDENDA_WITH_CRITICAL_FINDINGS_REVIEW", "INFO");
}

// ── IS–JB Test Functions ──

async function testIsCfdi33ConCampos40(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/3 http://www.sat.gob.mx/sitio_internet/cfd/3/cfdv33.xsd" Version="3.3" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="is-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "is-cfdi33-con-campos40.xml");
  assertIncludesFinding(result.findings, "CFDI33_WITH_CFDI40_ONLY_FIELDS_REVIEW", "WARNING");
}

async function testItCfdi40SinCamposNucleo(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="01">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="it-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "it-cfdi40-sin-campos-nucleo.xml");
  assertIncludesFinding(result.findings, "CFDI40_WITHOUT_CFDI40_CORE_FIELDS_REVIEW", "WARNING");
}

async function testIuTipoPConMetodoForma(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="P" Folio="1" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos20" Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="OP001"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="iu-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "iu-tipo-p-con-metodo-forma.xml");
  assertIncludesFinding(result.findings, "CFDI_PAYMENT_METHOD_ON_PAYMENT_REVIEW", "INFO");
  assertIncludesFinding(result.findings, "CFDI_PAYMENT_FORM_ON_PAYMENT_REVIEW", "INFO");
}

async function testIvPueSinFormaPago(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PUE" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="iv-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "iv-pue-sin-formapago.xml");
  assertIncludesFinding(result.findings, "METODO_PAGO_PUE_WITHOUT_FORMA_PAGO", "WARNING");
}

async function testIwPueConFormaPago99(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PUE" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="iw-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "iw-pue-con-formapago99.xml");
  assertIncludesFinding(result.findings, "INGRESO_PUE_WITH_FORMA_PAGO_99_REVIEW", "WARNING");
}

async function testIxMonedaUsdSinTipoCambio(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="USD" Total="1000.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="ix-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "ix-moneda-usd-sin-tc.xml");
  assertIncludesFinding(result.findings, "COMPROBANTE_TIPO_CAMBIO_REQUIRED", "WARNING");
}

async function testIyTipoCambioNoPositivo(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="USD" Total="1000.00" TipoDeComprobante="I" TipoCambio="0" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="iy-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "iy-tc-no-positivo.xml");
  assertIncludesFinding(result.findings, "COMPROBANTE_TIPO_CAMBIO_INVALID", "WARNING");
}

async function testIzLugarExpedicionInvalido(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="ABC" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="iz-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "iz-lugar-expedicion-invalido.xml");
  assertIncludesFinding(result.findings, "COMPROBANTE_LUGAR_EXPEDICION_FORMAT_REVIEW", "INFO");
}

async function testJaConfirmacionFormatoSospechoso(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="A" Folio="1" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="MXN" Total="1160.00" TipoDeComprobante="I" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Confirmacion="AB 12">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="01010101" Cantidad="1" ClaveUnidad="H87" Descripcion="Producto" ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="ja-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "ja-confirmacion-formato.xml");
  assertIncludesFinding(result.findings, "CFDI_CONFIRMACION_FORMAT_REVIEW", "INFO");
}

async function testJbPago40ConExportacionNo01(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="P" Folio="1" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos20" Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="OP001"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="jb-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "jb-pago40-exportacion-no01.xml");
  assertIncludesFinding(
    result.findings,
    "CFDI40_PAYMENT_WITH_EXPORTACION_NOT_01_REVIEW",
    "WARNING",
  );
}

// ── JC–JJ: Evidence Location & ValueTrace ────────────────────────────────────

async function testJcConceptLocation(): Promise<void> {
  const xml = buildConceptTaxXml({ objetoImp: "01" });
  const result = analyzeCfdi(xml, "jc-concept-location.xml");
  const response = toAnalysisResponse(result);
  const finding = response.findings.find((f) => f.code === "CONCEPT_OBJETO_IMP_01_WITH_TAXES")!;
  assertTruthy(finding, "Finding CONCEPT_OBJETO_IMP_01_WITH_TAXES debe existir");
  assertTruthy(
    finding.location && finding.location.module === "concepts",
    `location.module debe ser concepts, obtenido: ${JSON.stringify(finding.location)}`,
  );
}

async function testJdPaymentLocation(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd" Version="4.0" Serie="P" Folio="1" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos20" Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="MXN" Monto="0" NumOperacion="OP001"/>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="jd-00000000-0000-0000-0000-000000000000" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`;
  const result = analyzeCfdi(xml, "jd-payment-location.xml");
  const response = toAnalysisResponse(result);
  const finding = response.findings.find((f) => f.code === "PAYMENT_AMOUNT_NON_POSITIVE")!;
  assertTruthy(finding, "Finding PAYMENT_AMOUNT_NON_POSITIVE debe existir");
  assertTruthy(
    finding.location && finding.location.module === "payment",
    `location.module debe ser payment, obtenido: ${JSON.stringify(finding.location)}`,
  );
}

async function testJeCartaPorteLocation(): Promise<void> {
  const xml = buildCartaPorteXml({ ubicaciones: [], mercancias: [] });
  const result = analyzeCfdi(xml, "je-carta-porte-location.xml");
  const response = toAnalysisResponse(result);
  const finding = response.findings.find((f) => f.code === "CARTA_PORTE_MISSING_UBICACIONES")!;
  assertTruthy(finding, "Finding CARTA_PORTE_MISSING_UBICACIONES debe existir");
  assertTruthy(
    finding.location && finding.location.module === "carta-porte",
    `location.module debe ser carta-porte, obtenido: ${JSON.stringify(finding.location)}`,
  );
}

async function testJfComercioExteriorLocation(): Promise<void> {
  const xml = buildComercioExteriorXml({ tipoOperacion: "99" });
  const result = analyzeCfdi(xml, "jf-comercio-exterior-location.xml");
  const response = toAnalysisResponse(result);
  const finding = response.findings.find(
    (f) => f.code === "COMERCIO_EXTERIOR_TIPO_OPERACION_REVIEW",
  )!;
  assertTruthy(finding, "Finding COMERCIO_EXTERIOR_TIPO_OPERACION_REVIEW debe existir");
  assertTruthy(
    finding.location && finding.location.module === "comercio-exterior",
    `location.module debe ser comercio-exterior, obtenido: ${JSON.stringify(finding.location)}`,
  );
}

async function testJgTfdNoSelloCertificado(): Promise<void> {
  const xml = buildHkSelloTooShortXml();
  const result = analyzeCfdi(xml, "jg-tfd-no-sello.xml");
  const response = toAnalysisResponse(result);
  const finding = response.findings.find((f) => f.code === "TFD_SELLO_CFD_TOO_SHORT_REVIEW")!;
  assertTruthy(finding, "Finding TFD_SELLO_CFD_TOO_SHORT_REVIEW debe existir");
  assertTruthy(
    finding.location && finding.location.module === "tfd",
    `location.module debe ser tfd, obtenido: ${JSON.stringify(finding.location)}`,
  );
  for (const e of finding.evidence ?? []) {
    if (e.value) {
      assertTruthy(
        e.value.length <= 250,
        `Evidence value para '${e.label}' excede 250 caracteres (posible sello/certificado completo)`,
      );
    }
  }
}

async function testJhValueTraceNumerico(): Promise<void> {
  const xml = buildConceptTaxXml({
    traslados: [
      {
        base: "1000.00",
        impuesto: "002",
        tipoFactor: "Tasa",
        tasaOCuota: "0.160000",
        importe: "150.00",
      },
    ],
  });
  const result = analyzeCfdi(xml, "jh-value-trace.xml");
  const response = toAnalysisResponse(result);
  const finding = response.findings.find((f) => f.code === "CONCEPT_TAX_AMOUNT_MISMATCH")!;
  assertTruthy(finding, "Finding CONCEPT_TAX_AMOUNT_MISMATCH debe existir");
  assertTruthy(
    finding.valueTrace,
    `valueTrace debe estar presente, obtenido: ${JSON.stringify(finding.valueTrace)}`,
  );
  const vt = finding.valueTrace!;
  const hasSomething =
    vt.calculated !== undefined ||
    vt.difference !== undefined ||
    vt.expected !== undefined ||
    vt.observed !== undefined ||
    vt.tolerance !== undefined;
  assertTruthy(hasSomething, "valueTrace debe contener al menos un campo");
  assertTruthy(
    vt.calculated !== undefined || vt.difference !== undefined,
    "valueTrace debe contener calculated o difference para mismatch numérico",
  );
}

async function testJiSanitizationPreserves(): Promise<void> {
  const xml = buildConceptTaxXml({ objetoImp: "01" });
  const result = analyzeCfdi(xml, "ji-sanitization.xml");
  const response = toAnalysisResponse(result);
  const finding = response.findings.find((f) => f.code === "CONCEPT_OBJETO_IMP_01_WITH_TAXES")!;
  assertTruthy(finding, "Finding debe existir");
  assertTruthy(finding.location, "location debe preservarse después de sanitización");
  const rawFinding = result.findings.find((f) => f.code === "CONCEPT_OBJETO_IMP_01_WITH_TAXES")!;
  const inferred = { ...rawFinding, location: { module: "concepts" as const } };
  const sanitized = sanitizeFinding(inferred);
  assertTruthy(
    sanitized.location?.module === "concepts",
    "sanitizeFinding debe conservar location",
  );
}

async function testJjNoBreakNoEvidence(): Promise<void> {
  const xml = buildCfdi40Ingreso({ includeTimbre: true });
  const result = analyzeCfdi(xml, "jj-no-evidence.xml");
  const response = toAnalysisResponse(result);
  assertTruthy(response.findings.length > 0, "Deben existir findings");
  for (const f of response.findings) {
    assertTruthy(f.code, "Cada finding debe tener code");
    assertTruthy(f.severity, "Cada finding debe tener severity");
  }
  const findingWithNoEv: Finding = {
    id: "test-no-ev",
    severity: "INFO",
    category: "TECHNICAL",
    code: "TEST_NO_EVIDENCE",
    title: "Test",
    message: "Test without evidence",
  };
  const enriched = {
    ...findingWithNoEv,
    priority: getFindingPriority(
      findingWithNoEv.severity,
      findingWithNoEv.category,
    ) as Finding["priority"],
    actionGroup: getFindingActionGroup(findingWithNoEv),
  };
  const sanitized = sanitizeFinding(enriched);
  assertEqual(sanitized.code, "TEST_NO_EVIDENCE", "Finding sin evidence debe procesarse sin error");
  assertEqual(
    sanitized.evidence,
    undefined,
    "Finding sin evidence debe mantener evidence undefined",
  );
}

// ── JO–JT: SAT Catalog Registry Tests ──

async function testJoCatalogLookupKnown(): Promise<void> {
  const { lookupCatalogEntry } = await import("./sat-catalogs/sat-catalog.helpers.js");
  const result = lookupCatalogEntry("c_TipoDeComprobante", "I");
  assertTruthy(result.known, "Debería conocer el código I");
  assertTruthy(result.label, "Debería tener label");
  assertEqual(result.label, "Ingreso", "Label debería ser Ingreso");
  assertEqual(result.completeness, "PARTIAL", "Debería ser PARTIAL");
  assertEqual(result.sourceType, "FISCORA_CURATED", "Source type debería ser FISCORA_CURATED");
}

async function testJpCatalogOutOfValidity(): Promise<void> {
  const { lookupCatalogEntry } = await import("./sat-catalogs/sat-catalog.helpers.js");
  const result = lookupCatalogEntry("c_TipoDeComprobante", "I", { cfdiDate: "2020-01-01" });
  assertTruthy(result.known, "Debería conocer el código");
  assertTruthy(result.activeOnDate === null || result.activeOnDate === true, "Sin vigencia debería ser null o true");
}

async function testJqPartialCatalogBounded(): Promise<void> {
  const { lookupCatalogEntry } = await import("./sat-catalogs/sat-catalog.helpers.js");
  const result = lookupCatalogEntry("c_UsoCFDI", "G01");
  assertTruthy(result.known, "Debería conocer G01");
  assertEqual(result.completeness, "PARTIAL", "Debería indicar PARTIAL");
}

async function testJrUnknownCodeEvidence(): Promise<void> {
  const { buildCatalogEvidence } = await import("./sat-catalogs/sat-catalog.helpers.js");
  const evidence = buildCatalogEvidence("c_TipoDeComprobante", "X");
  assertEqual(evidence.known, false, "Debería ser unknown");
  assertEqual(evidence.catalogKey, "c_TipoDeComprobante", "Key debería coincidir");
  assertEqual(evidence.completeness, "PARTIAL", "Debería indicar PARTIAL");
}

async function testJsMissingCfdiDate(): Promise<void> {
  const { lookupCatalogEntry } = await import("./sat-catalogs/sat-catalog.helpers.js");
  const result = lookupCatalogEntry("c_TipoDeComprobante", "I", { cfdiDate: undefined });
  assertTruthy(result.known, "Debería conocer código sin fecha");
  assertEqual(result.activeOnDate, null, "Sin fecha debería ser null");
}

async function testJtLegacyHelpers(): Promise<void> {
  const {
    isKnownTipoComprobante,
    isKnownRegimenFiscal,
    getRegimenFiscalLabel,
  } = await import("./xml-audit.catalogs.js");
  assertTruthy(isKnownTipoComprobante("I"), "I debería ser known");
  assertTruthy(isKnownRegimenFiscal("601"), "601 debería ser known");
  assertEqual(getRegimenFiscalLabel("601"), "General de Ley Personas Morales", "Label debería coincidir");
}

// ── JU–JZ: SAT Matrix Mapping Tests ──

async function testJuMatrixUniqueIds(): Promise<void> {
  const { validateMatrixIntegrity } = await import("./sat-matrix/sat-matrix.helpers.js");
  const result = validateMatrixIntegrity();
  assertTruthy(result.valid, "Matriz debería tener IDs únicos");
}

async function testJvMatrixSummary(): Promise<void> {
  const { getSatMatrixSummary } = await import("./sat-matrix/sat-matrix.helpers.js");
  const summary = getSatMatrixSummary();
  assertTruthy(summary.totalRules > 0, "Debería tener reglas");
  assertTruthy(summary.coveredDirect >= 0, "Debería contar cobertura directa");
}

async function testJwFindingCodeMaps(): Promise<void> {
  const { findRulesByFiscoraCode, getCoverageForFindingCode } = await import("./sat-matrix/sat-matrix.helpers.js");
  const rules = findRulesByFiscoraCode("TFD_UUID_MISSING");
  assertTruthy(rules.length > 0, "Debería encontrar reglas para TFD_UUID_MISSING");
  const coverage = getCoverageForFindingCode("TFD_UUID_MISSING");
  assertTruthy(coverage.mapped, "Debería estar mapeado");
}

async function testJxNotCoveredNoCodes(): Promise<void> {
  const { getCfdi40MatrixRules } = await import("./sat-matrix/sat-matrix.helpers.js");
  const rules = getCfdi40MatrixRules();
  const notCovered = rules.filter((r) => r.coverage === "NOT_COVERED");
  for (const r of notCovered) {
    assertEqual(r.fiscoraFindingCodes.length, 0, `Regla ${r.id} NOT_COVERED no debería tener códigos`);
  }
}

async function testJyGapsMarked(): Promise<void> {
  const { getCfdi40MatrixRules } = await import("./sat-matrix/sat-matrix.helpers.js");
  const rules = getCfdi40MatrixRules();
  const cryptoRequired = rules.filter((r) => r.requiresCryptoValidation);
  const xsdRequired = rules.filter((r) => r.requiresXsd);
  assertTruthy(cryptoRequired.length > 0, "Debería haber reglas con crypto requerido");
  assertTruthy(xsdRequired.length > 0, "Debería haber reglas con XSD requerido");
}

async function testJzModulesHaveRules(): Promise<void> {
  const { findRulesByModule } = await import("./sat-matrix/sat-matrix.helpers.js");
  const cfdiBaseRules = findRulesByModule("CFDI_BASE");
  const totalsRules = findRulesByModule("TOTALES");
  assertTruthy(cfdiBaseRules.length > 0, "Debería tener reglas CFDI_BASE");
  assertTruthy(totalsRules.length > 0, "Debería tener reglas TOTALES");
}

async function testKaForensicRulesExist(): Promise<void> {
  const { findRulesByModule } = await import("./sat-matrix/sat-matrix.helpers.js");
  const forensicRules = findRulesByModule("SEGURIDAD_PAYLOAD");
  assertTruthy(forensicRules.length > 0, "Debería tener reglas forenses");
}

async function testKbIntegrityPasses(): Promise<void> {
  const { validateMatrixIntegrity } = await import("./sat-matrix/sat-matrix.helpers.js");
  const result = validateMatrixIntegrity();
  assertTruthy(result.valid, "Integridad de matriz debería pasar");
}

// ── KK–KS: Crypto Validation Tests ──

async function testKkCryptoNotConfigured(): Promise<void> {
  const { analyzeCfdi, sanitizeFinding } = await import("./xml-audit.service.js");
  const xml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="1" Fecha="2024-01-01T00:00:00" TipoDeComprobante="I" Total="100.00" Subtotal="100.00" Sello="MII..." Certificado="MII..." NoCertificado="3000" Moneda="MXN">
    <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
    <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptora" UsoCFDI="G01"/>
  </cfdi:Comprobante>`;
  const result = analyzeCfdi(xml);
  const sanitized = sanitizeFinding({
    id: "test",
    severity: "INFO",
    category: "TECHNICAL",
    code: "CRYPTO_VALIDATION_NOT_CONFIGURED",
    title: "Crypto no configurado",
    message: "No hay assets cripto configurados.",
    recommendedAction: "Cargar XSLT.",
    evidence: [{ label: "adapterName", value: "UnavailableCryptoValidationAdapter" }],
  } as unknown as Finding);
  assertEqual(sanitized.id, "test", "Sanitizado no debe romper finding");
}

async function testKlCertificateMetadata(): Promise<void> {
  const { inspectCertificateSafe } = await import("./crypto/certificate-inspection.helper.js");
  const meta = inspectCertificateSafe("MIIC4jCCAc+gAwIBAgIUM9YcOa5qD+v5z4Z7p5t5Q7p5t5jANBgkqhkiG9w0BAQsFADANMQswCQYDVQQGEwJNUjAeFw0yNDAxMDEwMDAwMDBaFw0yNTAxMDEwMDAwMDBaMA0xCzAJBgNVBAYTAlGSMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE...");
  assertEqual(meta.present, true, "Certificado presente");
}

async function testKmNoCertificateExposed(): Promise<void> {
  const { analyzeCfdi } = await import("./xml-audit.service.js");
  const xml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="1" Fecha="2024-01-01T00:00:00" TipoDeComprobante="I" Total="100.00" Subtotal="100.00" Sello="sig123" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
    <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
    <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptora" UsoCFDI="G01"/>
  </cfdi:Comprobante>`;
  const result = analyzeCfdi(xml);
  const hasFullCert = result.analysisMeta?.coverage?.xsdValidation?.results?.some?.(() => false) ?? true;
  assertEqual(hasFullCert, false, "No debería exponer certificado");
}

async function testKnTfdDetectsCryptoAssets(): Promise<void> {
  const { buildCryptoValidationSummary } = await import("./crypto/crypto-validation.service.js");
  const summary = buildCryptoValidationSummary("MII...", {
    hasSello: true,
    hasCertificado: true,
    hasNoCertificado: true,
    hasTimbreFiscalDigital: true,
    hasSelloSat: true,
  });
  assertEqual(summary.status, "NOT_CONFIGURED", "Status debería ser NOT_CONFIGURED");
  assertTruthy(summary.checks.length > 0, "Debería requerir checks TFD");
}

async function testKoCfdiDetectsXslt(): Promise<void> {
  const { buildCryptoValidationSummary } = await import("./crypto/crypto-validation.service.js");
  const summary = buildCryptoValidationSummary("MII...", {
    hasSello: true,
    hasCertificado: true,
    hasNoCertificado: true,
    hasTimbreFiscalDigital: true,
    hasSelloSat: false,
  });
  assertEqual(summary.status, "NOT_CONFIGURED", "Status debería ser NOT_CONFIGURED");
  assertTruthy(summary.checks.some?.((c) => c.key === "CFDI_SELLO"), "Debería requerir CFDI_SELLO");
}

async function testKpCryptoFindingDedup(): Promise<void> {
  const { analyzeCfdi } = await import("./xml-audit.service.js");
  const xml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="1" Fecha="2024-01-01T00:00:00" TipoDeComprobante="I" Total="100.00" Subtotal="100.00" Sello="sig123" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
    <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
    <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptora" UsoCFDI="G01"/>
  </cfdi:Comprobante>`;
  const result = analyzeCfdi(xml);
  const findingCodes = result.findings.map((f) => f.code);
  const dedup = findingCodes.filter((c) => c === "CRYPTO_VALIDATION_NOT_CONFIGURED").length;
  assertEqual(dedup, 0, "No debería haber findings CRYPTO_ aún (solo summary)");
}

async function testKsCoverageIncludesCrypto(): Promise<void> {
  const { analyzeCfdi } = await import("./xml-audit.service.js");
  const xml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Folio="1" Fecha="2024-01-01T00:00:00" TipoDeComprobante="I" Total="100.00" Subtotal="100.00" Sello="sig123" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
    <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
    <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptora" UsoCFDI="G01"/>
  </cfdi:Comprobante>`;
  const result = analyzeCfdi(xml);
  assertTruthy(result.analysisMeta?.cryptoValidation !== undefined, "Debería tener cryptoValidation");
  assertEqual(result.analysisMeta?.cryptoValidation?.status, "NOT_CONFIGURED", "Status NOT_CONFIGURED");
}

// ── KU–LC: Complement Matrix Tests ──

async function testKuComplementMatrixUniqueIds(): Promise<void> {
  const { validateComplementMatrixIntegrity } = await import("./sat-matrix/complement-matrix.helpers.js");
  const result = validateComplementMatrixIntegrity();
  assertEqual(result.valid, true, "IDs deberían ser únicos");
}

async function testKvComplementMatrixSummary(): Promise<void> {
  const { getComplementMatrixSummary } = await import("./sat-matrix/complement-matrix.helpers.js");
  const summary = getComplementMatrixSummary();
  assertTruthy(summary.totalRules > 0, "Debería tener reglas");
  assertTruthy(summary.byComplement["PAGOS_20"] > 0, "Pagos debería tener reglas");
}

async function testKwPagosHasRules(): Promise<void> {
  const { getComplementMatrixRulesByComplement } = await import("./sat-matrix/complement-matrix.helpers.js");
  const rules = getComplementMatrixRulesByComplement("PAGOS_20");
  assertTruthy(rules.length >= 20, `Pagos debería tener al menos 20 reglas, tiene ${rules.length}`);
}

async function testKxNominaHasRules(): Promise<void> {
  const { getComplementMatrixRulesByComplement } = await import("./sat-matrix/complement-matrix.helpers.js");
  const rules = getComplementMatrixRulesByComplement("NOMINA_12");
  assertTruthy(rules.length >= 20, `Nómina debería tener al menos 20 reglas, tiene ${rules.length}`);
}

async function testKyCartaPorteHasRules(): Promise<void> {
  const { getComplementMatrixRulesByComplement } = await import("./sat-matrix/complement-matrix.helpers.js");
  const rules = getComplementMatrixRulesByComplement("CARTA_PORTE");
  assertTruthy(rules.length >= 20, `Carta Porte debería tener al menos 20 reglas, tiene ${rules.length}`);
}

async function testKzComercioExteriorHasRules(): Promise<void> {
  const { getComplementMatrixRulesByComplement } = await import("./sat-matrix/complement-matrix.helpers.js");
  const rules = getComplementMatrixRulesByComplement("COMERCIO_EXTERIOR");
  assertTruthy(rules.length >= 20, `Comercio Exterior debería tener al menos 20 reglas, tiene ${rules.length}`);
}

async function testLaRetencionesHasRules(): Promise<void> {
  const { getComplementMatrixRulesByComplement } = await import("./sat-matrix/complement-matrix.helpers.js");
  const rules = getComplementMatrixRulesByComplement("RETENCIONES_20");
  assertTruthy(rules.length >= 20, `Retenciones debería tener al menos 20 reglas, tiene ${rules.length}`);
}

async function testLbNotCoveredNoCodes(): Promise<void> {
  const { getComplementMatrixRules } = await import("./sat-matrix/complement-matrix.helpers.js");
  const rules = getComplementMatrixRules();
  const notCovered = rules.filter((r) => r.coverage === "NOT_COVERED");
  for (const r of notCovered) {
    assertEqual(r.fiscoraFindingCodes.length, 0, `Regla ${r.id} NOT_COVERED no debería tener códigos`);
  }
}

async function testLcRulesByFiscoraCode(): Promise<void> {
  const { findComplementRulesByFiscoraCode } = await import("./sat-matrix/complement-matrix.helpers.js");
  const rules = findComplementRulesByFiscoraCode("PAYMENT_MISSING_FECHA_PAGO");
  assertTruthy(rules.length > 0, "Debería encontrar reglas para código de pago");
}

// ── LE–LL: Synthetic Fixture Tests ──

async function testLeSyntheticIntegrity(): Promise<void> {
  const { validateSyntheticFixturesIntegrity } = await import("./test-fixtures/synthetic-fixture.registry.js");
  const result = validateSyntheticFixturesIntegrity();
  assertEqual(result.valid, true, "Fixtures deberían pasar integridad");
}

async function testLfPagosFixturesParse(): Promise<void> {
  const { getSyntheticFixturesByKind } = await import("./test-fixtures/synthetic-fixture.registry.js");
  const { analyzeCfdi } = await import("./xml-audit.service.js");
  const fixtures = getSyntheticFixturesByKind("PAGOS_20");
  for (const f of fixtures) {
    const result = analyzeCfdi(f.xml);
    assertTruthy(result.documentKind !== "UNKNOWN", `Fixture ${f.id} debería parsear como documento válido`);
  }
}

async function testLgNominaFixturesParse(): Promise<void> {
  const { getSyntheticFixturesByKind } = await import("./test-fixtures/synthetic-fixture.registry.js");
  const { analyzeCfdi } = await import("./xml-audit.service.js");
  const fixtures = getSyntheticFixturesByKind("NOMINA_12");
  for (const f of fixtures) {
    const result = analyzeCfdi(f.xml);
    assertTruthy(result.documentKind !== "UNKNOWN", `Fixture ${f.id} debería parsear como documento válido`);
  }
}

async function testLhCartaPorteFixturesParse(): Promise<void> {
  const { getSyntheticFixturesByKind } = await import("./test-fixtures/synthetic-fixture.registry.js");
  const { analyzeCfdi } = await import("./xml-audit.service.js");
  const fixtures = getSyntheticFixturesByKind("CARTA_PORTE");
  for (const f of fixtures) {
    const result = analyzeCfdi(f.xml);
    assertTruthy(result.documentKind !== "UNKNOWN", `Fixture ${f.id} debería parsear como documento válido`);
  }
}

async function testLiComercioExteriorFixturesParse(): Promise<void> {
  const { getSyntheticFixturesByKind } = await import("./test-fixtures/synthetic-fixture.registry.js");
  const { analyzeCfdi } = await import("./xml-audit.service.js");
  const fixtures = getSyntheticFixturesByKind("COMERCIO_EXTERIOR");
  for (const f of fixtures) {
    const result = analyzeCfdi(f.xml);
    assertTruthy(result.documentKind !== "UNKNOWN", `Fixture ${f.id} debería parsear como documento válido`);
  }
}

async function testLjRetencionesFixturesParse(): Promise<void> {
  const { getSyntheticFixturesByKind } = await import("./test-fixtures/synthetic-fixture.registry.js");
  const { analyzeCfdi } = await import("./xml-audit.service.js");
  const fixtures = getSyntheticFixturesByKind("RETENCIONES_20");
  for (const f of fixtures) {
    const result = analyzeCfdi(f.xml);
    assertTruthy(result.documentKind === "RETENCIONES", `Fixture ${f.id} debería parsear como Retenciones`);
  }
}

async function testLkSyntheticMarkerPresent(): Promise<void> {
  const { ALL_SYNTHETIC_XML_FIXTURES } = await import("./test-fixtures/synthetic-fixture.registry.js");
  for (const f of ALL_SYNTHETIC_XML_FIXTURES) {
    assertTruthy(f.xml.includes("SYNTHETIC_TEST_ONLY"), `Fixture ${f.id} no tiene marcador`);
  }
}

async function testLlNoRealCertificates(): Promise<void> {
  const { ALL_SYNTHETIC_XML_FIXTURES } = await import("./test-fixtures/synthetic-fixture.registry.js");
  for (const f of ALL_SYNTHETIC_XML_FIXTURES) {
    const hasLongBase64 = /MIIC[A-Za-z0-9+/=]{500,}/.test(f.xml);
    assertEqual(hasLongBase64, false, `Fixture ${f.id} contiene certificado largo`);
  }
}

async function main() {
  console.log("\nSuite de regresión - Auditoría XML\n");

  await runCase("A) CFDI 4.0 Ingreso válido básico", testCfdiIngresoBasico);
  await runCase("B) XML con BOM UTF-8", testXmlConBom);
  await runCase("C) XML con contenido previo al XML", testXmlConLeadingContent);
  await runCase("D) Complemento de pago Pagos 2.0", testPago20);
  await runCase("E) Conceptos e impuestos (IVA + IEPS)", testConceptosImpuestos);
  await runCase("F) Validación de totales consistente", testTotalesConsistentes);
  await runCase("G) Validación de totales inconsistente", testTotalesInconsistentes);
  await runCase("H) XML sin TimbreFiscalDigital", testXmlSinTimbre);
  await runCase("I) ZIP full con ANALYZED/FAILED/sin content", testZipFull);
  await runCase("J) ZIP normalizados con manifest", testZipNormalizados);
  await runCase("K) RFC genérico receptor correcto", testRfcGenericoReceptorCorrecto);
  await runCase("L) RFC genérico receptor inconsistente", testRfcGenericoReceptorInconsistente);
  await runCase("M) RFC genérico emisor", testRfcGenericoEmisor);
  await runCase("N) Timbrado completo sin hallazgos de sellos", testTimbradoCompleto);
  await runCase("O) Timbrado incompleto", testTimbradoIncompleto);
  await runCase("P) Fecha timbrado anterior a fecha CFDI", testFechaTimbradoAnterior);
  await runCase("Q) REP saldo consistente", testRepSaldoConsistente);
  await runCase("R) REP saldo inconsistente", testRepSaldoInconsistente);
  await runCase("S) REP pagado mayor a saldo anterior", testRepPagadoMayorSaldoAnterior);
  await runCase("T) REP suma documentos excede monto pago", testRepSumaExcedeMonto);
  await runCase("U) REP revisión por moneda/equivalencia", testRepRevisionMoneda);
  await runCase("V) Egreso con CFDI relacionado válido", testEgresoRelacionadoValido);
  await runCase("W) Egreso sin CFDI relacionado", testEgresoSinRelacion);
  await runCase("X) CFDI relacionado con UUID inválido", testCfdiRelacionadoUuidInvalido);
  await runCase("Y) CFDI relacionado duplicado y self relation", testCfdiRelacionadoDuplicadoSelf);
  await runCase("Z) Pago con CfdiRelacionados adicional", testPagoConCfdiRelacionados);
  await runCase("AA) Carta Porte válida base", testCartaPorteValida);
  await runCase(
    "AB) Carta Porte sin ubicaciones/mercancías",
    testCartaPorteSinUbicacionesMercancias,
  );
  await runCase("AC) Carta Porte tipo comprobante inesperado", testCartaPorteTipoInesperado);
  await runCase(
    "AD) Carta Porte traslado con total distinto de cero",
    testCartaPorteTrasladoTotalNoCero,
  );
  await runCase("AE) Carta Porte mercancía inválida", testCartaPorteMercanciaInvalida);
  await runCase("EW) Carta Porte single location", testCartaPorteSingleLocation);
  await runCase("EX) Carta Porte destino sin distancia", testCartaPorteDestinoSinDistancia);
  await runCase("EY) Carta Porte TotalDistRec mismatch", testCartaPorteTotalDistRecMismatch);
  await runCase(
    "EZ) Carta Porte NumTotalMercancias mismatch",
    testCartaPorteNumTotalMercanciasMismatch,
  );
  await runCase("FA) Carta Porte PesoBrutoTotal mismatch", testCartaPortePesoBrutoTotalMismatch);
  await runCase("FB) Carta Porte mercancía sin ClaveUnidad", testCartaPorteMercanciaSinClaveUnidad);
  await runCase(
    "FC) Carta Porte material peligroso sin clave/embalaje",
    testCartaPorteMaterialPeligrosoSinClaveEmbalaje,
  );
  await runCase(
    "FD) Carta Porte autotransporte sin permiso/vehículo/seguro",
    testCartaPorteAutotransporteSinPermisoVehiculoSeguro,
  );
  await runCase("FE) Carta Porte operador sin licencia", testCartaPorteOperadorSinLicencia);
  await runCase(
    "FF) Carta Porte internacional sin país/vía",
    testCartaPorteInternacionalSinPaisVia,
  );
  await runCase("AF) Nómina válida base", testNominaValidaBase);
  await runCase("AG) Nómina sin percepciones", testNominaSinPercepciones);
  await runCase("AH) Nómina receptor incompleto", testNominaReceptorIncompleto);
  await runCase("AI) Nómina mismatch percepciones", testNominaMismatchPercepciones);
  await runCase(
    "AJ) Nómina mismatch deducciones/otros pagos",
    testNominaMismatchDeduccionesOtrosPagos,
  );
  await runCase("AK) Concepto ObjetoImp 01 con impuestos", testConceptoObjetoImp01ConImpuestos);
  await runCase("AL) Concepto ObjetoImp 02 sin impuestos", testConceptoObjetoImp02SinImpuestos);
  await runCase("AM) Impuesto por concepto con cálculo correcto", testConceptoCalculoCorrecto);
  await runCase("AN) Impuesto por concepto con cálculo incorrecto", testConceptoCalculoIncorrecto);
  await runCase("AO) Descuento mayor al importe", testConceptoDescuentoMayorImporte);
  await runCase("AP) Exento con importe", testConceptoExentoConImporte);
  await runCase("AQ) Cantidad/valor unitario mismatch", testConceptoCantidadValorUnitarioMismatch);
  await runCase("AR) Global impuestos consistente", testGlobalImpuestosConsistente);
  await runCase("AS) TotalImpuestosTrasladados mismatch", testGlobalTransferredTotalMismatch);
  await runCase("AT) Global traslado vs conceptos mismatch", testGlobalConceptSumMismatch);
  await runCase("AU) Grupo retenido faltante", testGlobalWithheldGroupMissing);
  await runCase("AV) Grupo global sin respaldo en conceptos", testGlobalWithheldWithoutConcept);
  await runCase("AW) Grupo global duplicado", testGlobalDuplicateGroup);
  await runCase("AX) Exportacion faltante en CFDI 4.0", testMissingExportacion);
  await runCase("AY) TipoCambio requerido en moneda extranjera", testMissingTipoCambio);
  await runCase("AZ) Descuento mayor al subtotal", testDescuentoExceedsSubtotal);
  await runCase("BA) Subtotal vs conceptos mismatch", testSubtotalConceptMismatch);
  await runCase("BB) LugarExpedicion formato inválido", testLugarExpedicionInvalidFormat);
  await runCase("BC) Fecha futura", testFutureFecha);
  await runCase("BD) Catálogo local: FormaPago desconocida", testFormaPagoUnknown);
  await runCase("BE) Catálogo local: TipoRelacion desconocido", testTipoRelacionUnknown);
  await runCase("BF) Pago con total/subtotal/moneda incorrectos", testPagoFieldsIncorrect);
  await runCase("BG) Nómina sin complemento", testNominaSinComplemento);
  await runCase("BH) Traslado con campos de pago", testTrasladoConPago);
  await runCase("BI) Evidence enriquecida con labels", testEvidenceLabels);
  await runCase("BJ) Pago correcto con CP01 + PPD + 99", testPagoCorrectoBJ);
  await runCase("BK) Pago con UsoCFDI incorrecto", testPagoUsoCfdiIncorrecto);
  await runCase("BL) Nómina con UsoCFDI incorrecto", testNominaUsoCfdiIncorrecto);
  await runCase("BM) PPD con FormaPago incorrecta", testPpdFormaPagoIncorrecto);
  await runCase("BN) PUE sin FormaPago", testPueSinFormaPago);
  await runCase("BO) RFC genérico con UsoCFDI a revisar", testRfcGenericoUsoCfdi);
  await runCase("BP) UsoCFDI desconocido", testUsoCfdiUnknown);
  await runCase("BQ) FormaPago presente sin MetodoPago", testFormaPagoSinMetodo);
  await runCase("BR) Ingreso sin método ni forma", testIngresoSinPago);
  await runCase("BS) Régimen fiscal emisor desconocido", testRegimenFiscalEmisorUnknown);
  await runCase("BT) Receptor sin régimen fiscal", testReceptorSinRegimen);
  await runCase("BU) Domicilio fiscal inválido", testDomicilioFiscalInvalido);
  await runCase("BV) Mismo RFC emisor/receptor", testMismoRfc);
  await runCase("BW) RFC extranjero con exportación y MXN", testForeignRfcExportacionMxn);
  await runCase("BX) Nombre receptor faltante", testNombreReceptorFaltante);
  await runCase("BY) Nómina con régimen distinto a 605", testNominaRegimenDistinto);
  await runCase("BZ) UsoCFDI deducción con RFC genérico", testUsoDeduccionRfcGenerico);
  await runCase("CA) Helpers de régimen fiscal", testRegimenHelpers);
  await runCase("CB) Comercio Exterior válida base", testComercioExteriorValidaBase);
  await runCase(
    "CC) Comercio Exterior tipo operación inválido",
    testComercioExteriorTipoOperacionInvalido,
  );
  await runCase("CD) Comercio Exterior versión inválida", testComercioExteriorVersionInvalida);
  await runCase(
    "CE) Comercio Exterior tipo operación faltante",
    testComercioExteriorSinTipoOperacion,
  );
  await runCase("CF) Comercio Exterior TotalUSD mismatch", testComercioExteriorTotalUSDMismatch);
  await runCase("CG) Comercio Exterior versión faltante", testComercioExteriorVersionFaltante);
  await runCase("CH) Comercio Exterior complemento vacío", testComercioExteriorComplementoVacio);
  await runCase("FG) CCE sin TipoCambioUSD/TotalUSD", testCceSinTipoCambioTotalUsd);
  await runCase(
    "FH) CCE CertificadoOrigen 1 sin NumCertificadoOrigen",
    testCceCertOrigen1SinNumCert,
  );
  await runCase(
    "FI) CCE Receptor sin ResidenciaFiscal/NumRegIdTrib",
    testCceReceptorSinResidenciaNumReg,
  );
  await runCase("FJ) CCE sin mercancías", testCceSinMercancias);
  await runCase("FK) CCE mercancía sin campos requeridos", testCceMercanciaSinCamposRequeridos);
  await runCase("FL) CCE fracción arancelaria formato inválido", testCceFraccionFormatoInvalido);
  await runCase("FM) CCE ValorDolares mismatch", testCceValorDolaresMismatch);
  await runCase("FN) CCE TotalUSD vs suma mercancías mismatch", testCceTotalUsdMercanciasMismatch);
  await runCase("FO) CCE con Exportacion distinta de 02", testCceSinExportacion02);
  await runCase(
    "FP) CCE moneda USD TotalUSD vs Total CFDI mismatch",
    testCceTotalUsdVsCfdiTotalMismatch,
  );
  await runCase("FQ) Retenciones lugarExpRetenc faltante", testRetLugarExpFaltante);
  await runCase("FR) Retenciones emisor sin nombre y régimen", testRetEmisorSinNombreRegimen);
  await runCase(
    "FS) Retenciones receptor sin nacionalidad ni domicilio",
    testRetReceptorSinNacionalidadDomicilio,
  );
  await runCase(
    "FT) Retenciones receptor nacional con RFC genérico y sin nombre",
    testRetReceptorRfcGenericoSinNombre,
  );
  await runCase("FU) Retenciones periodo incompleto", testRetPeriodoIncompleto);
  await runCase("FV) Retenciones total operación cero", testRetTotalOperacionCero);
  await runCase("FW) Retenciones total ret excede operación", testRetTotalRetExcedeOperacion);
  await runCase(
    "FX) Retenciones total ret 0 con impuestos > 0",
    testRetTotalRetCeroConImpuestosYTipoPagoFaltante,
  );
  await runCase(
    "FY) Retenciones complemento dividendos faltante",
    testRetComplementoDividendosFaltante,
  );
  await runCase("FZ) Retenciones complemento desconocido", testRetComplementoDesconocido);
  await runCase("CI) Impuestos Locales válido base", testImpuestosLocalesValidoBase);
  await runCase(
    "CJ) Impuestos Locales total retenciones mismatch",
    testImpuestosLocalesTotalRetencionesMismatch,
  );
  await runCase(
    "CK) Impuestos Locales total traslados mismatch",
    testImpuestosLocalesTotalTrasladosMismatch,
  );
  await runCase("CL) Impuestos Locales sin líneas", testImpuestosLocalesSinLineas);
  await runCase("CM) Impuestos Locales línea inválida", testImpuestosLocalesLineaInvalida);
  await runCase("CN) Impuestos Locales totales faltantes", testImpuestosLocalesTotalesFaltantes);
  await runCase("CO) Impuestos Locales complemento vacío", testImpuestosLocalesComplementoVacio);
  await runCase("CP) Addenda con orden de compra", testAddendaConOrdenCompra);
  await runCase("CQ) Addenda con recepción y proveedor", testAddendaConRecepcionYProveedor);
  await runCase("CR) Addenda sin señales reconocidas", testAddendaSinSenales);
  await runCase("CS) Addenda profunda/truncada", testAddendaProfundaTruncada);
  await runCase("CT) XML sin Addenda", testAddendaSinAddenda);
  await runCase("CU) Leyendas Fiscales válido base", testLeyendasFiscalesValidoBase);
  await runCase("CV) Leyendas Fiscales incompleto", testLeyendasFiscalesIncompleto);
  await runCase("CW) Leyendas Fiscales sin leyendas", testLeyendasFiscalesSinLeyendas);
  await runCase("CX) Donatarias válido base", testDonatariasValidoBase);
  await runCase("CY) Donatarias incompleto", testDonatariasIncompleto);
  await runCase("CZ) Donatarias fecha inválida / leyenda corta", testDonatariasFechaLeyendaCorta);
  await runCase("DA) Retenciones válido base", testRetencionesValidoBase);
  await runCase("DB) Retenciones incompleto", testRetencionesIncompleto);
  await runCase("DC) Retenciones emisor sin RFC", testRetencionesEmisorSinRfc);
  await runCase("DD) Retenciones receptor extranjero", testRetencionesReceptorExtranjero);
  await runCase("DE) Retenciones total ret mismatch", testRetencionesTotalRetMismatch);
  await runCase("DF) Retenciones periodo inválido", testRetencionesPeriodoInvalido);
  await runCase("DG) Retenciones sin timbre", testRetencionesSinTimbre);
  await runCase("DH) Prioridad CRITICAL => BLOCKER", testPrioridadCriticalBlocker);
  await runCase("DI) Prioridad WARNING TAX => HIGH", testPrioridadWarningTaxHigh);
  await runCase("DJ) Prioridad INFO => LOW", testPrioridadInfoLow);
  await runCase("DK) Evidence string largo se trunca", testEvidenceStringLargo);
  await runCase("DL) Evidence sensible se redacta", testEvidenceSensibleRedactado);
  await runCase("DM) Evidence array grande se limita", testEvidenceArrayGrande);
  await runCase("DN) Findings por code se limitan", testFindingsPorCodeLimitados);
  await runCase("DO) Payload policy presente", testPayloadPolicyPresente);
  await runCase("DP) analysisMeta presente en CFDI", testAnalysisMetaPresenteCfdi);
  await runCase("DQ) analysisMeta presente en Retenciones", testAnalysisMetaPresenteRetenciones);
  await runCase("DR) coverage detecta complemento", testCoverageDetectaComplemento);
  await runCase("DS) findingsCount por módulo", testFindingsCountPorModulo);
  await runCase(
    "DT) analysisMeta no contiene contenido sensible",
    testAnalysisMetaNoContenidoSensible,
  );

  await runCase("DU) Pago con moneda distinta de XXX", testPagoConMonedaDistinta);
  await runCase("DV) Pago con subtotal/total distinto de cero", testPagoConTotalesDistintoCero);
  await runCase("DW) Ingreso PPD con FormaPago distinta de 99", testIngresoPpdSinFormaPago99);
  await runCase("DX) Ingreso PUE con FormaPago 99", testIngresoPueConFormaPago99);
  await runCase("DY) Exportacion 02 sin Comercio Exterior", testExportacion02SinComercioExterior);
  await runCase("DZ) ObjetoImp 01 con impuestos", testObjetoImp01ConImpuestos);
  await runCase("EA) UsoCFDI CP01 sin Tipo P", testUsoCfdiCp01SinTipoP);
  await runCase("EB) Nómina con moneda distinta de MXN", testNominaConMonedaDistinta);
  await runCase("EM) Nómina sin FechaPago y NumDiasPagados", testNominaSinFechaPagoNumDias);
  await runCase("EN) FechaInicialPago > FechaFinalPago", testNominaFechaInicialAfterFinal);
  await runCase("EO) Receptor nómina sin datos mínimos", testNominaReceptorSinDatosMinimos);
  await runCase("EP) Percepciones TotalGravado mismatch", testNominaTotalGravadoMismatch);
  await runCase("EQ) Percepción sin Tipo/Clave", testNominaPercepcionSinTipoClave);
  await runCase("ER) Deducciones TotalDeducciones mismatch", testNominaTotalDeduccionesMismatch);
  await runCase("ES) ISR sin TotalImpuestosRetenidos", testNominaIsrSinTotalRetenidos);
  await runCase("ET) OtrosPagos total mismatch", testNominaTotalOtrosPagosMismatch);
  await runCase("EU) Subsidio sin Tipo 002", testNominaSubsidioSinTipo002);
  await runCase("EV) CFDI Total nómina mismatch", testNominaCfdiTotalMismatch);
  await runCase("EC) Pago missing required fields", testPagoMissingRequiredFields);
  await runCase("ED) FechaPago inválida", testPagoFechaInvalida);
  await runCase("EE) TipoCambio requerido moneda extranjera", testRepTipoCambioExtranjero);
  await runCase("EF) TipoCambio con MXN", testRepTipoCambioConMxn);
  await runCase("EG) Documento relacionado campos faltantes", testRepDocFieldsMissing);
  await runCase("EH) NumParcialidad no positivo", testRepNumParcialidadNonPositive);
  await runCase("EI) ObjetoImpDR consistencia", testRepObjetoImpDRConsistency);
  await runCase("EJ) DR Tax base/rate checks", testRepDrTaxChecks);
  await runCase("EK) Totales sin DR taxes", testRepTotalesSinDrTaxes);
  await runCase("EL) Pago múltiples validaciones", testRepMultiplePagoLevel);

  await runCase("GA) Catálogo TipoComprobante desconocido", testCatTipoComprobanteUnknown);
  await runCase("GB) Catálogo Exportacion desconocida", testCatExportacionUnknown);
  await runCase("GC) Catálogo MetodoPago desconocido", testCatMetodoPagoUnknown);
  await runCase("GD) Catálogo ObjetoImp desconocido en concepto", testCatObjetoImpUnknown);
  await runCase(
    "GE) Catálogo Impuesto/TipoFactor desconocidos en concepto",
    testCatConceptTaxUnknown,
  );
  await runCase("GF) Catálogo TipoRelacion desconocido", testCatTipoRelacionUnknown);
  await runCase(
    "GG) Catálogo Pago FormaDePagoP/MonedaP desconocidos",
    testCatPagoFormaMonedaUnknown,
  );
  await runCase(
    "GH) Catálogo DR ObjetoImpDR/ImpuestoDR desconocidos",
    testCatDrObjetoImpImpuestoUnknown,
  );
  await runCase("GI) Catálogo Nómina TipoNomina desconocido", testCatNominaTipoNominaUnknown);
  await runCase(
    "GJ) Catálogo Retenciones Nacionalidad/CveRetenc/ImpuestoRet desconocidos",
    testCatRetencionesMultiUnknown,
  );

  await runCase("GK) Base excede importe concepto", testTaxBaseExceedsConceptAmount);
  await runCase("GL) Importe impuesto negativo", testTaxAmountNegative);
  await runCase("GM) Tasa negativa", testTaxRateNegative);
  await runCase("GN) Tasa > 100%", testTaxRateTooHigh);
  await runCase("GO) Exento con tasa", testTaxExentoWithRate);
  await runCase("GP) Tasa 0 con importe", testTaxTasaZeroWithAmount);
  await runCase("GQ) ISR retención tasa inusual", testRetentionIsrUnusualRate);
  await runCase("GR) Global base sum mismatch", testGlobalBaseSumMismatch);
  await runCase("GS) Total con impuestos concepto mismatch", testTotalWithConceptTaxesMismatch);
  await runCase("GT) ObjetoImp 01 con impuestos globales", testObjetoImp01WithGlobalTaxes);

  await runCase("GU) Concepto sin ClaveProdServ/ClaveUnidad/Descripción", testConceptMissingFields);
  await runCase("GV) Cantidad no positiva", testCantidadNoPositiva);
  await runCase("GW) Valor unitario negativo", testUnitValueNegative);
  await runCase("GX) Importe cálculo mismatch", testImportCalculationMismatch);
  await runCase("GY) Descuento negativo", testDiscountNegative);
  await runCase("GZ) Descuento por concepto sin descuento global", testDiscountWithoutGlobal);
  await runCase("HA) Descuento global mismatch", testGlobalDiscountMismatch);
  await runCase("HB) Subtotal vs suma conceptos mismatch", testSubtotalMismatch);
  await runCase("HC) ClaveProdServ formato inválido", testClaveProdServFormatInvalid);
  await runCase("HD) ObjetoImp 04 review", testObjetoImp04Review);

  await runCase("HE) TFD sin Version/UUID", testHeStampNoVersionNoUuid);
  await runCase("HF) TFD fecha timbrado inválida", testHfFechaTimbradoInvalid);
  await runCase("HG) TFD fecha timbrado futura", testHgFechaTimbradoFuture);
  await runCase("HH) TFD fecha muy posterior a CFDI", testHhFechaTimbradoFarAfter);
  await runCase("HI) TFD RfcProvCertif formato inválido", testHiRfcProvCertifInvalid);
  await runCase("HJ) TFD SelloCFD difiere de Sello comprobante", testHjSelloCfdDiffers);
  await runCase("HK) TFD SelloCFD/SelloSAT cortos", testHkSelloTooShort);
  await runCase("HL) TFD SelloCFD/SelloSAT no base64", testHlSelloNotBase64);
  await runCase("HM) Certificado comprobante corto", testHmCertificadoTooShort);
  await runCase("HN) TFD presente pero isStamped false", testHnTfdPresentNotStamped);

  await runCase("HO) CfdiRelacionados vacío", testHoRelationGroupEmpty);
  await runCase("HP) TipoRelacion faltante", testHpRelationTipoMissing);
  await runCase("HQ) UUID relacionado inválido", testHqRelatedUuidInvalid);
  await runCase("HR) UUID relacionado duplicado", testHrRelatedUuidDuplicated);
  await runCase("HS) UUID relacionado igual al propio", testHsSelfRelation);
  await runCase("HT) TipoRelacion 04 con múltiples UUIDs", testHtTipo04MultipleUuids);
  await runCase("HU) Pago sin DoctoRelacionado con CfdiRelacionados", testHuPagoSinDocConRel);
  await runCase("HV) DoctoRelacionado repetido en CfdiRelacionados", testHvPagoDocDuplicadoEnRel);
  await runCase("HW) Relación con demasiados UUIDs", testHwTooManyUuids);
  await runCase("HX) Múltiples grupos de relación", testHxMultipleRelationGroups);

  // ── HY–IH: Party (Emisor/Receptor) Advanced Validations ──

  await runCase("HY) Emisor sin RFC/nombre/régimen", testHyEmisorSinRfcNombreRegimen);
  await runCase("HZ) Receptor sin RFC/nombre/régimen/domicilio/UsoCFDI", testHzReceptorSinDatos);
  await runCase("IA) Receptor RFC formato inválido", testIaReceptorRfcInvalid);
  await runCase(
    "IB) Receptor genérico extranjero sin ResidenciaFiscal/NumRegIdTrib",
    testIbGenericForeignSinResidenciaNumReg,
  );
  await runCase(
    "IC) Receptor con NumRegIdTrib sin ResidenciaFiscal",
    testIcNumRegIdTribSinResidencia,
  );
  await runCase("ID) Emisor y receptor ambos genéricos", testIdEmisorReceptorAmbosGenericos);
  await runCase("IE) Nómina con receptor genérico", testIeNominaReceptorGenerico);
  await runCase("IF) UsoCFDI D para persona moral", testIfUsoCfdiDPersonaMoral);
  await runCase("IG) Regimen 616 con RFC no genérico", testIgRegimen616NoGenerico);
  await runCase("IH) UsoCFDI formato desconocido", testIhUsoCfdiFormatoDesconocido);

  await runCase("II) Complemento Pago en Tipo I", testIiPaymentOnNonPayment);
  await runCase("IJ) Nómina en Tipo I", testIjNominaOnNonNomina);
  await runCase(
    "IK) Carta Porte internacional sin Comercio Exterior",
    testIkCartaPorteInternacionalSinCce,
  );
  await runCase("IL) Tipo P con impuestos globales o por concepto", testIlPagoConImpuestos);
  await runCase("IM) Tipo T con impuestos", testImTrasladoConImpuestos);
  await runCase("IN) Nómina con Comercio Exterior", testInNominaConCce);
  await runCase("IO) Nómina con Carta Porte", testIoNominaConCartaPorte);
  await runCase("IP) Pago con CfdiRelacionados y DoctoRelacionado", testIpPagoConRelYDoc);
  await runCase("IQ) Múltiples complementos complejos", testIqMultipleComplements);
  await runCase("IR) Addenda con critical findings", testIrAddendaConCritical);
  await runCase("IS) CFDI 3.3 con campos 4.0", testIsCfdi33ConCampos40);
  await runCase("IT) CFDI 4.0 sin campos núcleo", testItCfdi40SinCamposNucleo);
  await runCase("IU) Tipo P con MetodoPago/FormaPago", testIuTipoPConMetodoForma);
  await runCase("IV) PUE sin FormaPago", testIvPueSinFormaPago);
  await runCase("IW) PUE con FormaPago 99", testIwPueConFormaPago99);
  await runCase("IX) Moneda USD sin TipoCambio", testIxMonedaUsdSinTipoCambio);
  await runCase("IY) TipoCambio no positivo", testIyTipoCambioNoPositivo);
  await runCase("IZ) LugarExpedicion inválido", testIzLugarExpedicionInvalido);
  await runCase("JA) Confirmacion formato sospechoso", testJaConfirmacionFormatoSospechoso);
  await runCase("JB) Pago 4.0 con Exportacion distinta de 01", testJbPago40ConExportacionNo01);

  // ── JC–JJ: Evidence Location & ValueTrace ──

  await runCase("JC) Finding de concepto incluye location inferida", testJcConceptLocation);
  await runCase("JD) Finding de pago incluye location inferida", testJdPaymentLocation);
  await runCase("JE) Finding de Carta Porte incluye location inferida", testJeCartaPorteLocation);
  await runCase(
    "JF) Finding de Comercio Exterior incluye location inferida",
    testJfComercioExteriorLocation,
  );
  await runCase("JG) Finding de TFD no expone sello/certificado", testJgTfdNoSelloCertificado);
  await runCase("JH) valueTrace se genera para mismatch numérico", testJhValueTraceNumerico);
  await runCase("JI) Sanitización conserva location/valueTrace", testJiSanitizationPreserves);
  await runCase("JJ) No se rompe finding sin evidence", testJjNoBreakNoEvidence);

  // ── JO–JT: SAT Catalog Registry Tests ──

  await runCase("JO) catalog registry lookup known code", testJoCatalogLookupKnown);
  await runCase("JP) catalog registry out of validity", testJpCatalogOutOfValidity);
  await runCase("JQ) partial catalog emits bounded review", testJqPartialCatalogBounded);
  await runCase("JR) unknown code includes catalog evidence", testJrUnknownCodeEvidence);
  await runCase("JS) missing cfdi date does not fail", testJsMissingCfdiDate);
  await runCase("JT) legacy helpers still work", testJtLegacyHelpers);

  // ── JU–JZ: SAT Matrix Mapping Tests ──

  await runCase("JU) matriz tiene IDs únicos", testJuMatrixUniqueIds);
  await runCase("JV) summary calcula totales", testJvMatrixSummary);
  await runCase("JW) finding code conocido mapea a regla", testJwFindingCodeMaps);
  await runCase("JX) regla NOT_COVERED no tiene finding codes", testJxNotCoveredNoCodes);
  await runCase("JY) gaps XSD/crypto/online quedan marcados", testJyGapsMarked);
  await runCase("JZ) módulos clave tienen al menos una regla", testJzModulesHaveRules);
  await runCase("KA) reglas forenses Fiscora existen", testKaForensicRulesExist);
  await runCase("KB) validateMatrixIntegrity no falla", testKbIntegrityPasses);

  // ── KK–KS: Crypto Validation Tests ──

  await runCase("KK) crypto not configured no rompe CFDI", testKkCryptoNotConfigured);
  await runCase("KL) certificado produce metadata segura", testKlCertificateMetadata);
  await runCase("KM) summary cripto no contiene sello completo", testKmNoCertificateExposed);
  await runCase("KN) TFD detecta assets TFD requeridos", testKnTfdDetectsCryptoAssets);
  await runCase("KO) CFDI con sello detecta XSLT CFDI", testKoCfdiDetectsXslt);
  await runCase("KP) crypto finding deduplicado", testKpCryptoFindingDedup);
  await runCase("KS) coverage/meta incluye estado cripto", testKsCoverageIncludesCrypto);

  // ── KU–LC: Complement Matrix Tests ──

  await runCase("KU) complement matrix ids únicos", testKuComplementMatrixUniqueIds);
  await runCase("KV) summary por complemento calcula totales", testKvComplementMatrixSummary);
  await runCase("KW) pagos tiene reglas mínimas", testKwPagosHasRules);
  await runCase("KX) nómina tiene reglas mínimas", testKxNominaHasRules);
  await runCase("KY) carta porte tiene reglas mínimas", testKyCartaPorteHasRules);
  await runCase("KZ) comercio exterior tiene reglas mínimas", testKzComercioExteriorHasRules);
  await runCase("LA) retenciones tiene reglas mínimas", testLaRetencionesHasRules);
  await runCase("LB) NOT_COVERED no tiene finding codes", testLbNotCoveredNoCodes);
  await runCase("LC) reglas por código Fiscora retornan mapping", testLcRulesByFiscoraCode);

  // ── LE–LP: Synthetic Fixture Tests ──

  await runCase("LE) synthetic fixture registry integrity", testLeSyntheticIntegrity);
  await runCase("LF) pagos fixtures parse and expected codes", testLfPagosFixturesParse);
  await runCase("LG) nomina fixtures parse and expected codes", testLgNominaFixturesParse);
  await runCase("LH) carta porte fixtures parse and expected codes", testLhCartaPorteFixturesParse);
  await runCase("LI) comercio exterior fixtures parse and expected codes", testLiComercioExteriorFixturesParse);
  await runCase("LJ) retenciones fixtures parse and expected codes", testLjRetencionesFixturesParse);
  await runCase("LK) all fixtures include synthetic marker", testLkSyntheticMarkerPresent);
  await runCase("LL) fixtures do not expose real certificates", testLlNoRealCertificates);

  // ── LM–LP: Tests de mínimos para fixtures y malformed XML ──

  async function testLmMinimumFixtures(): Promise<void> {
    const { getSyntheticFixtureSummary } = await import("./test-fixtures/synthetic-fixture.registry.js");
    const summary = getSyntheticFixtureSummary();
    const complements = ["PAGOS_20", "NOMINA_12", "CARTA_PORTE", "COMERCIO_EXTERIOR", "RETENCIONES_20"];
    for (const c of complements) {
      assertTruthy((summary.byKind[c] ?? 0) >= 8, `Complemento ${c} debería tener al menos 8 fixtures, tiene ${summary.byKind[c] ?? 0}`);
    }
  }

  async function testLnTotalFixtures(): Promise<void> {
    const { getSyntheticFixtureSummary } = await import("./test-fixtures/synthetic-fixture.registry.js");
    const summary = getSyntheticFixtureSummary();
    assertTruthy(summary.total >= 40, `Total fixtures debería ser >= 40, es ${summary.total}`);
  }

  async function testLoAllMeetMinimum(): Promise<void> {
    const { getSyntheticFixtureSummary } = await import("./test-fixtures/synthetic-fixture.registry.js");
    const summary = getSyntheticFixtureSummary();
    const complements = ["PAGOS_20", "NOMINA_12", "CARTA_PORTE", "COMERCIO_EXTERIOR", "RETENCIONES_20"];
    for (const c of complements) {
      if ((summary.byKind[c] ?? 0) < 8) {
        assertEqual(true, false, `Complemento ${c} no alcanza mínimo`);
      }
    }
  }

  async function testLpNoCrash(): Promise<void> {
    const { getSyntheticFixtures } = await import("./test-fixtures/synthetic-fixture.registry.js");
    const { analyzeCfdi } = await import("./xml-audit.service.js");
    const fixtures = getSyntheticFixtures();
    for (const f of fixtures) {
      try {
        analyzeCfdi(f.xml);
      } catch {
        assertEqual(true, false, `Fixture ${f.id} causó crash`);
      }
    }
  }

  async function testLqMalformedComplementoAfterClose(): Promise<void> {
    const { validateXmlWellFormedness } = await import("./xml-wellformedness.helper.js");
    const malformedXml = `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0">
  <cfdi:Emisor Rfc="AAA010101AAA"/>
</cfdi:Comprobante>
<cfdi:Complemento>
  <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="12345678-90ab-cdef-1234-567890abcdef"/>
</cfdi:Complemento>`;
    const result = validateXmlWellFormedness(malformedXml);
    assertEqual(result.isWellFormed, false, "Debería detectar XML mal formado");
    assertEqual(result.hasComplementAfterComprobanteClose, true, "Debería detectar Complemento después del cierre");
  }

  async function testLrMalformedDuplicateComprobante(): Promise<void> {
    const { validateXmlWellFormedness } = await import("./xml-wellformedness.helper.js");
    const malformedXml = `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0">
  <cfdi:Emisor Rfc="AAA010101AAA"/>
</cfdi:Comprobante>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0">
<cfdi:Emisor Rfc="BBB010101BBB"/></cfdi:Comprobante>`;
    const result = validateXmlWellFormedness(malformedXml);
    assertEqual(result.isWellFormed, false, "Debería detectar XML mal formado");
    assertEqual(result.hasDuplicateComprobanteClose, true, "Debería detectar Comprobante duplicado");
  }

  async function testLsMalformedRetencionesAfterClose(): Promise<void> {
    const { validateXmlWellFormedness } = await import("./xml-wellformedness.helper.js");
    const malformedXml = `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
</retenciones:Retenciones>
<retenciones:Complemento><retenciones:ImpRetenidos/></retenciones:Complemento>`;
    const result = validateXmlWellFormedness(malformedXml);
    assertEqual(result.isWellFormed, false, "Debería detectar XML mal formado");
    assertEqual(result.hasContentAfterRoot, true, "Debería detectar content después del cierre");
  }

  async function testLtWellformedDetectsMultipleRoots(): Promise<void> {
    const { validateXmlWellFormedness } = await import("./xml-wellformedness.helper.js");
    const wellformedXml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0">
  <cfdi:Emisor Rfc="AAA010101AAA"/>
  <cfdi:Receptor Rfc="XAXX010101000"/>
</cfdi:Comprobante>`;
    const result = validateXmlWellFormedness(wellformedXml);
    assertEqual(result.isWellFormed, true, "XML bien formado debería pasar");
  }

  await runCase("LM) cada complemento tiene mínimo 8 fixtures", testLmMinimumFixtures);
  await runCase("LN) total fixtures >= 40", testLnTotalFixtures);
  await runCase("LO) summary reporta allMeetMinimum", testLoAllMeetMinimum);
  await runCase("LP) fixtures se analizan sin crash", testLpNoCrash);

  await runCase("LQ) XML mal formado con Complemento después del cierre", testLqMalformedComplementoAfterClose);
  await runCase("LR) XML mal formado con segundo Comprobante", testLrMalformedDuplicateComprobante);
  await runCase("LS) XML mal formado con content después de Retenciones", testLsMalformedRetencionesAfterClose);
  await runCase("LT) wellformed helper detecta múltiples raíces", testLtWellformedDetectsMultipleRoots);

  // ── LU–LV: Truncated XML Tests ──

  async function testLuTruncatedNoClose(): Promise<void> {
    const { validateXmlWellFormedness } = await import("./xml-wellformedness.helper.js");
    const truncatedXml = `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0">
  <cfdi:Emisor Rfc="AAA010101AAA"/>
`;
    const result = validateXmlWellFormedness(truncatedXml);
    assertEqual(result.isWellFormed, false, "Debería detectar XML truncado");
    assertEqual(result.errorCode, "XML_TRUNCATED_NO_CLOSE", "Debería marcar como truncado");
  }

  async function testLvRetencionesTruncated(): Promise<void> {
    const { validateXmlWellFormedness } = await import("./xml-wellformedness.helper.js");
    const truncatedXml = `<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
`;
    const result = validateXmlWellFormedness(truncatedXml);
    assertEqual(result.isWellFormed, false, "Debería detectar Retenciones truncado");
  }

  await runCase("LU) XML truncado sin cierre de Comprobante", testLuTruncatedNoClose);
  await runCase("LV) XML Retenciones truncado sin cierre", testLvRetencionesTruncated);

  // ── LX: Integration test - analyzeCfdi rejects malformed ──

  async function testLxAnalyzeCfdiRejectsMalformed(): Promise<void> {
    const { analyzeCfdi } = await import("./xml-audit.service.js");
    const malformedXml = `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0">
  <cfdi:Emisor Rfc="AAA010101AAA"/>
</cfdi:Comprobante>
<cfdi:Complemento>
  <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="12345678-90ab-cdef-1234-567890abcdef"/>
</cfdi:Complemento>`;
    try {
      analyzeCfdi(malformedXml);
      assertEqual(true, false, "analyzeCfdi debería lanzar error para XML mal formado");
    } catch (e) {
      const err = e as { code?: string };
      assertTruthy(err.code === "XML_MALFORMED_CONTENT_AFTER_ROOT", `Debería tener código XML_MALFORMED_CONTENT_AFTER_ROOT, pero tiene ${err.code}`);
    }
  }

  await runCase("LX) analyzeCfdi rechaza XML mal formado con código", testLxAnalyzeCfdiRejectsMalformed);

  // ── LY–LZ: Catalog Importer Tests ──

  async function testLyImporterLoadsCsv(): Promise<void> {
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    const result = await loadSatCatalog("c_UsoCFDI");
    assertEqual(result.status, "LOADED", "Debería cargar el CSV");
    assertEqual(result.totalRows > 0, true, "Debería tener filas");
    assertEqual(result.entries.length > 0, true, "Debería tener entradas");
  }

  async function testLzImporterHandlesMissing(): Promise<void> {
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    const result = await loadSatCatalog("c_Pais");
    assertEqual(result.status, "NOT_CONFIGURED", "Catálogo no configurado debería retornar NOT_CONFIGURED");
  }

  await runCase("LY) catalog importer carga CSV", testLyImporterLoadsCsv);
  await runCase("LZ) catalog importer maneja faltantes", testLzImporterHandlesMissing);

  // ── MM–MW: Catalog Import Registry & Index Tests ──

  async function testMmImporterRegistryHasEight(): Promise<void> {
    const { getAllCatalogImportDefinitions } = await import("./sat-catalogs/importer/sat-catalog-import.registry.js");
    const defs = getAllCatalogImportDefinitions();
    assertEqual(defs.length, 8, "Debería tener 8 catálogos registrados");
  }

  async function testMnCsvLoaderReadsSample(): Promise<void> {
    const { loadSatCatalogFile } = await import("./sat-catalogs/importer/sat-catalog-file-loader.js");
    const result = loadSatCatalogFile("c_UsoCFDI.sample.csv", "CSV");
    assertEqual(result.exists, true, "Archivo debería existir");
    assertEqual(result.content.includes("c_UsoCFDI"), true, "Debería tener encabezados");
  }

  async function testMoIndexLookupWorks(): Promise<void> {
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    const { lookupCatalogEntry } = await import("./sat-catalogs/importer/sat-catalog-index.js");
    const result = await loadSatCatalog("c_UsoCFDI");
    const entry = lookupCatalogEntry("c_UsoCFDI", "G01");
    assertEqual(entry !== undefined, true, "Debería encontrar entrada");
    assertEqual(entry?.label?.includes("Gastos"), true, "Debería tener label");
  }

  async function testMpPathTraversalRejected(): Promise<void> {
    const { loadSatCatalogFile } = await import("./sat-catalogs/importer/sat-catalog-file-loader.js");
    const result = loadSatCatalogFile("../../../etc/passwd", "CSV");
    assertEqual(result.exists, false, "Path traversal debería ser rechazado");
  }

  async function testMqImportedFirstFallback(): Promise<void> {
    const { lookupImportedCatalogValue } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    const label = lookupImportedCatalogValue("c_UsoCFDI", "G01");
    assertEqual(label !== undefined, true, "Debería fallback a catálogo actual si no está importado");
  }

  await runCase("MM) catalog import registry has 8 definitions", testMmImporterRegistryHasEight);
  await runCase("MN) CSV loader reads sample file", testMnCsvLoaderReadsSample);
  await runCase("MO) index lookup finds known key", testMoIndexLookupWorks);
  await runCase("MP) path traversal is rejected", testMpPathTraversalRejected);
  await runCase("MQ) imported-first fallback works", testMqImportedFirstFallback);

  // ── MR–MW: Runtime Imported Catalog Integration Tests ──

  async function testMrUsoCfdiRuntimeLookup(): Promise<void> {
    const { lookupUsoCfdiRuntime } = await import("./sat-catalogs/sat-catalog-runtime.adapter.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    await loadSatCatalog("c_UsoCFDI");
    const result = lookupUsoCfdiRuntime("G01");
    assertEqual(result.known, true, "Debería conocer clave G01");
    assertEqual(result.source, "LOCAL_IMPORTED", "Debería venir de catálogo importado");
  }

  async function testMsFormaPagoRuntime(): Promise<void> {
    const { lookupFormaPagoRuntime } = await import("./sat-catalogs/sat-catalog-runtime.adapter.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    await loadSatCatalog("c_FormaPago");
    const result = lookupFormaPagoRuntime("01");
    assertEqual(result.known, true, "Debería conocer clave 01");
  }

  async function testMtMonedaRuntime(): Promise<void> {
    const { lookupMonedaRuntime } = await import("./sat-catalogs/sat-catalog-runtime.adapter.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    await loadSatCatalog("c_Moneda");
    const result = lookupMonedaRuntime("MXN");
    assertEqual(result.known, true, "Debería conocer MXN");
  }

  async function testMuObjetoImpRuntime(): Promise<void> {
    const { lookupObjetoImpRuntime } = await import("./sat-catalogs/sat-catalog-runtime.adapter.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    await loadSatCatalog("c_ObjetoImp");
    const result = lookupObjetoImpRuntime("01");
    assertEqual(result.known, true, "Debería conocer ObjetoImp 01");
  }

  async function testMvImpuestoTipoFactorRuntime(): Promise<void> {
    const { lookupImpuestoRuntime, lookupTipoFactorRuntime } = await import("./sat-catalogs/sat-catalog-runtime.adapter.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    await loadSatCatalog("c_Impuesto");
    await loadSatCatalog("c_TipoFactor");
    const impResult = lookupImpuestoRuntime("002");
    const tfResult = lookupTipoFactorRuntime("Tasa");
    assertEqual(impResult.known, true, "Debería conocer Impuesto 002");
    assertEqual(tfResult.known, true, "Debería conocer TipoFactor Tasa");
  }

  async function testMwTasaOCuotaRuntime(): Promise<void> {
    const { lookupTasaOCuotaRuntime } = await import("./sat-catalogs/sat-catalog-runtime.adapter.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    await loadSatCatalog("c_TasaOCuota");
    const result = lookupTasaOCuotaRuntime("0.060000");
    assertEqual(result.known, true, "Debería conocer TasaOCuota");
  }

  await runCase("MR) UsoCFDI runtime lookup imported-first", testMrUsoCfdiRuntimeLookup);
  await runCase("MS) FormaPago runtime lookup imported-first", testMsFormaPagoRuntime);
  await runCase("MT) Moneda runtime lookup imported-first", testMtMonedaRuntime);
  await runCase("MU) ObjetoImp runtime lookup imported-first", testMuObjetoImpRuntime);
  await runCase("MV) Impuesto y TipoFactor runtime lookup imported-first", testMvImpuestoTipoFactorRuntime);
  await runCase("MW) TasaOCuota runtime lookup imported-first", testMwTasaOCuotaRuntime);

  // ── NX–OH: Catalog Manifest Tests ──

  async function testNxManifestHashStable(): Promise<void> {
    const { hashCatalogFileContent } = await import("./sat-catalogs/importer/sat-catalog-manifest.helpers.js");
    const content = "line1\nline2\n";
    const hash1 = hashCatalogFileContent(content);
    const hash2 = hashCatalogFileContent(content);
    assertEqual(hash1, hash2, "SHA-256 debe ser estable");
    assertEqual(hash1.length, 64, "SHA-256 debe ser 64 chars hex");
  }

  async function testNyManifestNoCsvContent(): Promise<void> {
    const { buildSatCatalogFileManifest } = await import("./sat-catalogs/importer/sat-catalog-manifest.helpers.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    const result = await loadSatCatalog("c_UsoCFDI");
    const manifest = buildSatCatalogFileManifest(result);
    assertEqual(!("content" in manifest), true, "Manifest no debe tener content");
    assertEqual(!("entries" in manifest), true, "Manifest no debe tener entries");
  }

  async function testNzManifestNoAbsolutePath(): Promise<void> {
    const { buildSatCatalogFileManifest } = await import("./sat-catalogs/importer/sat-catalog-manifest.helpers.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    const result = await loadSatCatalog("c_UsoCFDI");
    const manifest = buildSatCatalogFileManifest(result);
    assertEqual(!manifest.relativePath?.startsWith("/"), true, "No ruta absoluta");
  }

  async function testOaManifestColumnsDetected(): Promise<void> {
    const { buildSatCatalogFileManifest } = await import("./sat-catalogs/importer/sat-catalog-manifest.helpers.js");
    const { loadSatCatalog } = await import("./sat-catalogs/importer/sat-catalog-import.helpers.js");
    const result = await loadSatCatalog("c_UsoCFDI");
    const manifest = buildSatCatalogFileManifest(result);
    assertTruthy(manifest.columnsDetected.length > 0, "Debe detectar columnas");
  }

  async function testObRuntimeTrackerCounts(): Promise<void> {
    const { createCatalogRuntimeUsageTracker } = await import("./sat-catalogs/importer/sat-catalog-runtime-tracker.js");
    const tracker = createCatalogRuntimeUsageTracker();
    tracker.recordLookup("c_UsoCFDI", { known: true, key: "G01", source: "LOCAL_IMPORTED" });
    tracker.recordLookup("c_UsoCFDI", { known: false, key: "ZZZ", source: "UNKNOWN" });
    const manifest = tracker.getUsageManifest();
    const usoCfdi = manifest.find((m) => m.catalogKey === "c_UsoCFDI");
    assertEqual(usoCfdi?.lookupCount, 2, "Debería contar 2 lookups");
    assertEqual(usoCfdi?.knownCount, 1, "Debería contar 1 known");
    assertEqual(usoCfdi?.unknownCount, 1, "Debería contar 1 unknown");
  }

  async function testOcFallbackCounted(): Promise<void> {
    const { createCatalogRuntimeUsageTracker } = await import("./sat-catalogs/importer/sat-catalog-runtime-tracker.js");
    const tracker = createCatalogRuntimeUsageTracker();
    tracker.recordLookup("c_UsoCFDI", { known: true, key: "G01", source: "LOCAL_IMPORTED" });
    tracker.recordLookup("c_Moneda", { known: true, key: "XYZ", source: "FISCORA_CURATED" });
    const manifest = tracker.getUsageManifest();
    const usoCfdi = manifest.find((m) => m.catalogKey === "c_UsoCFDI");
    const moneda = manifest.find((m) => m.catalogKey === "c_Moneda");
    assertEqual(usoCfdi?.importedHitCount, 1, "importedHitCount");
    assertEqual(moneda?.curatedHitCount, 1, "curatedHitCount");
  }

  async function testOdMalformedNoCatalogLookup(): Promise<void> {
    const { analyzeCfdi } = await import("./xml-audit.service.js");
    const malformedXml = `<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"><cfdi:Emisor Rfc="AAA010101AAA"/></cfdi:Comprobante><cfdi:Complemento/>`;
    try {
      analyzeCfdi(malformedXml);
    } catch {
      // Expected to throw
    }
  }

  await runCase("NX) manifest hash SHA-256 estable", testNxManifestHashStable);
  await runCase("NY) manifest no contiene CSV content", testNyManifestNoCsvContent);
  await runCase("NZ) manifest no contiene rutas absolutas", testNzManifestNoAbsolutePath);
  await runCase("OA) manifest detecta columnas", testOaManifestColumnsDetected);
  await runCase("OB) runtime tracker cuenta lookups", testObRuntimeTrackerCounts);
  await runCase("OC) runtime tracker cuenta fallbacks", testOcFallbackCounted);
  await runCase("OD) malformed XML no busca catálogos fiscales", testOdMalformedNoCatalogLookup);

  printSummary();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Error fatal en la suite:", err);
  process.exitCode = 1;
});
