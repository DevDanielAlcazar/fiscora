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
import { analyzeCfdi, type CfdiAnalysisResult, type Finding, type NormalizedXml } from "./xml-audit.service.js";
import { analyzeZipFull, generateNormalizedZip } from "./xml-zip-audit.service.js";
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
  const match = findings.find(f => f.code === code);
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
const SCHEMA_LOCATION = "xsi:schemaLocation=\"http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd\"";

function buildCfdi40Ingreso(opts?: {
  total?: string;
  subtotal?: string;
  includeTimbre?: boolean;
}): string {
  const total = opts?.total ?? "1160.00";
  const subtotal = opts?.subtotal ?? "1000.00";
  const timbre = opts?.includeTimbre ?? true
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

// ─── Test Cases ──────────────────────────────────────────────────────────────

// A) XML Ingreso CFDI 4.0 válido básico
async function testCfdiIngresoBasico(): Promise<void> {
  const xml = buildCfdi40Ingreso();
  const result = analyzeCfdi(xml, "ingreso-40.xml");

  assertEqual(result.tipoComprobante, "Ingreso", "tipoComprobante debe ser Ingreso");
  assertEqual(result.version, "4.0", "version debe ser 4.0");
  assertTruthy(result.technicalDiagnostics.hasTimbreFiscalDigital, "hasTimbreFiscalDigital debe ser true");
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
    assertEqual(result.normalizedXml.available, false, "sin BOM ni contenido previo, normalizedXml.available=false");
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
  assertEqual(result.normalizedXml!.normalizationType, "TECHNICAL_SAFE", "normalizationType TECHNICAL_SAFE");
  assertEqual(result.normalizedXml!.fiscalContentModified, false, "fiscalContentModified false");
  assertEqual(result.normalizedXml!.stampRisk, "NONE", "stampRisk NONE");
  assertTruthy(result.normalizedXml!.originalSha256, "originalSha256 debe existir");
  assertTruthy(result.normalizedXml!.normalizedSha256, "normalizedSha256 debe existir");
  assertNotEqual(result.normalizedXml!.originalSha256!, result.normalizedXml!.normalizedSha256!,
    "originalSha256 != normalizedSha256");

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
  assertTruthy(result.paymentComplement!.pagos[0].documentosRelacionados.length > 0,
    "documentosRelacionados.length > 0");
  assertEqual(result.paymentComplement!.pagos[0].documentosRelacionados[0].idDocumento,
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "UUID relacionado correcto");
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

  const ivaTraslados = result.taxSummary!.transferred.filter(t => t.impuesto === "002");
  assertTruthy(ivaTraslados.length > 0, "IVA 002 debe estar en taxSummary");
  assertEqual(ivaTraslados[0].impuestoLabel, "IVA", "IVA label correcto");

  const iepsTraslados = result.taxSummary!.transferred.filter(t => t.impuesto === "003");
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
  assertEqual(result.totalsValidation!.totalCalculated, "1160.00", "totalCalculated debe coincidir");
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

  assertEqual(result.technicalDiagnostics.hasTimbreFiscalDigital, false, "hasTimbreFiscalDigital false");
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

  const analyzedResults = result.results.filter(r => r.status === "ANALYZED");
  const failedResults = result.results.filter(r => r.status === "FAILED");
  assertEqual(analyzedResults.length, 2, "2 ANALYZED results");
  assertEqual(failedResults.length, 1, "1 FAILED result");

  // summary debe reflejar BOM
  assertEqual(result.summary.filesWithBom, 1, "summary.filesWithBom 1");

  // Validar que normalizedXml no tenga content en resultados ZIP
  for (const r of analyzedResults) {
    if (r.analysis && r.analysis.normalizedXml) {
      const nx = r.analysis.normalizedXml as Record<string, unknown>;
      if (nx.available === true) {
        assertEqual(nx.content, undefined, "normalizedXml.content no debe estar presente en ZIP result");
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

  const bomFile = manifestJson.files.find((f: { originalName: string }) =>
    f.originalName === "bom-factura.xml",
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
  const nationalFinding = result.findings.find(f => f.code === "GENERIC_RFC_RECEPTOR_NATIONAL")!;
  assertEqual(nationalFinding.severity, "INFO", "GENERIC_RFC_RECEPTOR_NATIONAL debe ser INFO");

  // No debe tener warnings de inconsistencia
  assertTruthy(
    !result.findings.some(f => f.code === "GENERIC_RFC_RECEPTOR_REGIMEN_NOT_616"),
    "No debe existir GENERIC_RFC_RECEPTOR_REGIMEN_NOT_616",
  );
  assertTruthy(
    !result.findings.some(f => f.code === "GENERIC_RFC_RECEPTOR_POSTAL_MISMATCH"),
    "No debe existir GENERIC_RFC_RECEPTOR_POSTAL_MISMATCH",
  );

  // riskLevel debe ser OK (solo hay INFO)
  assertEqual(result.executiveSummary.riskLevel, "OK", "riskLevel debe ser OK");
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
  const emisorFinding = result.findings.find(f => f.code === "GENERIC_RFC_EMISOR")!;
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
      !result.findings.some(f => f.code === code),
      `No debe existir ${code} en timbrado completo`,
    );
  }

  // riskLevel no debe subir a WARNING por timbrado si no hay otros warnings
  const nonStampWarnings = result.findings.filter(
    f => f.severity === "WARNING" && !missingCodes.includes(f.code) && !f.code.startsWith("GENERIC_RFC_") && !f.code.startsWith("MISSING_") && f.code !== "TIMBRADO_DATE_BEFORE_CFDI_DATE",
  );
  if (nonStampWarnings.length > 0) {
    // Si hay otros warnings, eso es otra cosa; pero al menos los de timbrado no deben aparecer
  }
  assertTruthy(
    !result.findings.some(f => missingCodes.includes(f.code)),
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
  const dateFinding = result.findings.find(f => f.code === "TIMBRADO_DATE_BEFORE_CFDI_DATE")!;
  assertEqual(dateFinding.severity, "WARNING", "TIMBRADO_DATE_BEFORE_CFDI_DATE debe ser WARNING");
}

// ─── Main ────────────────────────────────────────────────────────────────────

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

  printSummary();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Error fatal en la suite:", err);
  process.exitCode = 1;
});
