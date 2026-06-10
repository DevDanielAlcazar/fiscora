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

function buildRepXml(opts?: {
  monedaP?: string;
  monto?: string;
  docs?: Array<{
    idDocumento?: string;
    monedaDR?: string;
    equivalenciaDR?: string;
    numParcialidad?: string;
    impSaldoAnt?: string;
    impPagado?: string;
    impSaldoInsoluto?: string;
  }>;
  includeTimbre?: boolean;
}): string {
  const monedaP = opts?.monedaP ?? "MXN";
  const monto = opts?.monto ?? "1000.00";
  const docs = opts?.docs ?? [{
    idDocumento: "a1111111-1111-4111-8111-111111111111",
    monedaDR: "MXN",
    equivalenciaDR: "1",
    numParcialidad: "1",
    impSaldoAnt: "1000.00",
    impPagado: "400.00",
    impSaldoInsoluto: "600.00",
  }];
  const includeTimbre = opts?.includeTimbre ?? true;

  const docsXml = docs.map((d) =>
    `        <pago20:DoctoRelacionado${d.idDocumento ? ` IdDocumento="${d.idDocumento}"` : ""} Serie="A" Folio="1"${d.monedaDR ? ` MonedaDR="${d.monedaDR}"` : ""}${d.equivalenciaDR ? ` EquivalenciaDR="${d.equivalenciaDR}"` : ""}${d.numParcialidad ? ` NumParcialidad="${d.numParcialidad}"` : ""}${d.impSaldoAnt ? ` ImpSaldoAnt="${d.impSaldoAnt}"` : ""}${d.impPagado ? ` ImpPagado="${d.impPagado}"` : ""}${d.impSaldoInsoluto ? ` ImpSaldoInsoluto="${d.impSaldoInsoluto}"` : ""} ObjetoImpDR="01"/>`
  ).join("\n");

  const timbre = includeTimbre
    ? `    <tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj" FechaTimbrado="2024-02-10T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${PAGO20_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="P" Folio="1" Fecha="2024-02-10T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="0.00" Moneda="XXX" Total="0.00" TipoDeComprobante="P" LugarExpedicion="12345" Exportacion="01">
  <cfdi:Emisor Rfc="XAXX010101000" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0.00" Importe="0.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Pago FechaPago="2024-02-10T10:30:00" FormaDePagoP="03" MonedaP="${monedaP}" Monto="${monto}" NumOperacion="OP001">
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
    docs: [{
      idDocumento: "a1111111-1111-4111-8111-111111111111",
      monedaDR: "MXN",
      equivalenciaDR: "1",
      numParcialidad: "1",
      impSaldoAnt: "1000.00",
      impPagado: "400.00",
      impSaldoInsoluto: "600.00",
    }],
  });

  const result = analyzeCfdi(xml, "rep-saldo-consistente.xml");

  assertTruthy(
    !result.findings.some(f => f.code === "RELATED_DOCUMENT_BALANCE_MISMATCH"),
    "No debe existir RELATED_DOCUMENT_BALANCE_MISMATCH",
  );
  assertTruthy(
    !result.findings.some(f => f.code === "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE"),
    "No debe existir RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE",
  );
  assertTruthy(
    !result.findings.some(f => f.code === "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT"),
    "No debe existir PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT",
  );
}

// R) REP saldo inconsistente
async function testRepSaldoInconsistente(): Promise<void> {
  const xml = buildRepXml({
    monto: "1000.00",
    monedaP: "MXN",
    docs: [{
      idDocumento: "b2222222-2222-4222-8222-222222222222",
      monedaDR: "MXN",
      equivalenciaDR: "1",
      numParcialidad: "1",
      impSaldoAnt: "1000.00",
      impPagado: "400.00",
      impSaldoInsoluto: "700.00",
    }],
  });

  const result = analyzeCfdi(xml, "rep-saldo-inconsistente.xml");

  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_BALANCE_MISMATCH");
  const mismatch = result.findings.find(f => f.code === "RELATED_DOCUMENT_BALANCE_MISMATCH")!;
  assertEqual(mismatch.severity, "CRITICAL", "RELATED_DOCUMENT_BALANCE_MISMATCH debe ser CRITICAL");
  assertEqual(result.executiveSummary.riskLevel, "CRITICAL", "riskLevel debe ser CRITICAL");
}

// S) REP pagado mayor a saldo anterior
async function testRepPagadoMayorSaldoAnterior(): Promise<void> {
  const xml = buildRepXml({
    monto: "1200.00",
    monedaP: "MXN",
    docs: [{
      idDocumento: "c3333333-3333-4333-8333-333333333333",
      monedaDR: "MXN",
      equivalenciaDR: "1",
      numParcialidad: "2",
      impSaldoAnt: "1000.00",
      impPagado: "1200.00",
      impSaldoInsoluto: "0.00",
    }],
  });

  const result = analyzeCfdi(xml, "rep-pagado-mayor.xml");

  assertIncludesFinding(result.findings, "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE");
  const exceed = result.findings.find(f => f.code === "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE")!;
  assertEqual(exceed.severity, "CRITICAL", "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE debe ser CRITICAL");
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
  const exceed = result.findings.find(f => f.code === "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT")!;
  assertEqual(exceed.severity, "CRITICAL", "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT debe ser CRITICAL");
}

// U) REP revisión por moneda/equivalencia
async function testRepRevisionMoneda(): Promise<void> {
  const xml = buildRepXml({
    monto: "1000.00",
    monedaP: "USD",
    docs: [{
      idDocumento: "f6666666-6666-4666-8666-666666666666",
      monedaDR: "MXN",
      equivalenciaDR: "17.50",
      numParcialidad: "1",
      impSaldoAnt: "1000.00",
      impPagado: "600.00",
      impSaldoInsoluto: "400.00",
    }],
  });

  const result = analyzeCfdi(xml, "rep-revision-moneda.xml");

  assertIncludesFinding(result.findings, "PAYMENT_TOTAL_RELATED_PAID_REVIEW");
  const review = result.findings.find(f => f.code === "PAYMENT_TOTAL_RELATED_PAID_REVIEW")!;
  assertEqual(review.severity, "INFO", "PAYMENT_TOTAL_RELATED_PAID_REVIEW debe ser INFO");
  assertTruthy(
    !result.findings.some(f => f.code === "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT"),
    "No debe existir PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT cuando hay moneda/equivalencia no comparable",
  );
}

function buildEgresoCfdiRelacionadosXml(uuidRel?: string, tipoRel?: string, extraRelUuids?: string[]): string {
  const relatedUuids = extraRelUuids ?? [];
  const allRels = uuidRel ? [uuidRel, ...relatedUuids] : relatedUuids;
  const relsXml = allRels.length > 0
    ? allRels.map(u => `      <cfdi:CfdiRelacionado UUID="${u}"/>`).join("\n")
    : "";
  const relacionesXml = relsXml
    ? `  <cfdi:CfdiRelacionados${tipoRel ? ` TipoRelacion="${tipoRel}"` : ""}>\n${relsXml}\n  </cfdi:CfdiRelacionados>`
    : "";
  const timbreRel = '<tfd:TimbreFiscalDigital ' + TFD_NS + ' Version="1.1" UUID="aaaaaa00-0000-4000-8000-000000000000" FechaTimbrado="2024-05-01T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>';

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
  const timbre = '<tfd:TimbreFiscalDigital ' + TFD_NS + ' Version="1.1" UUID="zzzzzz00-0000-4000-8000-000000000000" FechaTimbrado="2024-06-01T11:00:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/>';
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
    !result.findings.some(f => f.code === "EGRESO_WITHOUT_CFDI_RELACIONADOS"),
    "No debe existir EGRESO_WITHOUT_CFDI_RELACIONADOS",
  );
  assertTruthy(
    !result.findings.some(f => f.code === "CFDI_RELATED_UUID_NON_STANDARD"),
    "No debe existir CFDI_RELATED_UUID_NON_STANDARD",
  );
  assertTruthy(
    !result.findings.some(f => f.code === "CFDI_SELF_RELATION"),
    "No debe existir CFDI_SELF_RELATION",
  );
}

// W) Egreso sin CFDI relacionado
async function testEgresoSinRelacion(): Promise<void> {
  const xml = buildEgresoCfdiRelacionadosXml(undefined);
  const result = analyzeCfdi(xml, "egreso-sin-relacion.xml");

  assertIncludesFinding(result.findings, "EGRESO_WITHOUT_CFDI_RELACIONADOS");
  const finding = result.findings.find(f => f.code === "EGRESO_WITHOUT_CFDI_RELACIONADOS")!;
  assertEqual(finding.severity, "WARNING", "EGRESO_WITHOUT_CFDI_RELACIONADOS debe ser WARNING");
}

// X) CFDI relacionado con UUID inválido
async function testCfdiRelacionadoUuidInvalido(): Promise<void> {
  const xml = buildEgresoCfdiRelacionadosXml("ABC123", "01");
  const result = analyzeCfdi(xml, "cfdi-relacionado-uuid-invalido.xml");

  assertIncludesFinding(result.findings, "CFDI_RELATED_UUID_NON_STANDARD");
  const finding = result.findings.find(f => f.code === "CFDI_RELATED_UUID_NON_STANDARD")!;
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
  const finding = result.findings.find(f => f.code === "PAYMENT_WITH_CFDI_RELACIONADOS_REVIEW")!;
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
  ubicaciones?: Array<{ tipo: string; id?: string; rfc?: string; nombre?: string; fecha?: string; distancia?: string }>;
  mercancias?: Array<{ bienesTransp?: string; descripcion?: string; cantidad?: string; claveUnidad?: string; pesoEnKg?: string; valor?: string; moneda?: string }>;
  hasAutotransporte?: boolean;
}): string {
  const tipo = opts?.tipoComprobante ?? "T";
  const total = opts?.total ?? "0.00";
  const subtotal = opts?.subtotal ?? "0.00";
  const cpVersion = opts?.cpVersion ?? "3.1";
  const idCCP = opts?.idCCP ?? "CCP123456";
  const transpInternac = opts?.transpInternac ?? "No";
  const totalDistRec = opts?.totalDistRec ?? "500.00";
  const ubicaciones = opts?.ubicaciones ?? [
    { tipo: "Origen", id: "OR001", rfc: "EKU9003173C9", nombre: "ORIGEN SA", fecha: "2024-06-01T08:00:00" },
    { tipo: "Destino", id: "DE001", rfc: "EKU9003173C9", nombre: "DESTINO SA", fecha: "2024-06-01T18:00:00", distancia: "500.00" },
  ];
  const mercancias = opts?.mercancias ?? [
    { bienesTransp: "12101500", descripcion: "Material de construcción", cantidad: "10", claveUnidad: "KGM", pesoEnKg: "5000.00", valor: "50000.00", moneda: "MXN" },
  ];
  const hasAutotransporte = opts?.hasAutotransporte ?? true;

  const typeLabel = tipo === "T" ? "Traslado" : tipo === "I" ? "Ingreso" : tipo === "P" ? "Pago" : tipo === "E" ? "Egreso" : tipo;
  const cpNs = cpVersion === "3.1" ? "cartaporte31" : cpVersion === "3.0" ? "cartaporte30" : "cartaporte20";
  const cpNsUrl = cpVersion === "3.1" ? "http://www.sat.gob.mx/CartaPorte31" :
    cpVersion === "3.0" ? "http://www.sat.gob.mx/CartaPorte30" :
    "http://www.sat.gob.mx/CartaPorte20";

  const ubiXml = ubicaciones.map(u => {
    const idAttr = u.id ? ` IDUbicacion="${u.id}"` : "";
    const rfcAttr = u.rfc ? ` RFCRemitenteDestinatario="${u.rfc}"` : "";
    const nomAttr = u.nombre ? ` NombreRemitenteDestinatario="${u.nombre}"` : "";
    const fechaAttr = u.fecha ? ` FechaHoraSalidaLlegada="${u.fecha}"` : "";
    const distAttr = u.distancia ? ` DistanciaRecorrida="${u.distancia}"` : "";
    return `          <${cpNs}:Ubicacion TipoUbicacion="${u.tipo}"${idAttr}${rfcAttr}${nomAttr}${fechaAttr}${distAttr}/>`;
  }).join("\n");

  const merXml = mercancias.map(m => {
    const bt = m.bienesTransp ? ` BienesTransp="${m.bienesTransp}"` : "";
    const desc = m.descripcion ? ` Descripcion="${m.descripcion}"` : "";
    const cant = m.cantidad ? ` Cantidad="${m.cantidad}"` : "";
    const cu = m.claveUnidad ? ` ClaveUnidad="${m.claveUnidad}"` : "";
    const peso = m.pesoEnKg ? ` PesoEnKg="${m.pesoEnKg}"` : "";
    const val = m.valor ? ` ValorMercancia="${m.valor}"` : "";
    const mon = m.moneda ? ` Moneda="${m.moneda}"` : "";
    return `          <${cpNs}:Mercancia${bt}${desc}${cant}${cu}${peso}${val}${mon}/>`;
  }).join("\n");

  const cpNsAttr = `xmlns:${cpNs}="${cpNsUrl}"`;
  const autoXml = hasAutotransporte
    ? `        <${cpNs}:Autotransporte/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${cpNsAttr} ${SCHEMA_LOCATION} Version="4.0" Serie="CP" Folio="1" Fecha="2024-06-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="${subtotal}" Moneda="MXN" Total="${total}" TipoDeComprobante="${tipo}" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="EKU9003173C9" Nombre="CLIENTE SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="${tipo === "T" ? "S01" : "G03"}"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="78101802" Cantidad="1" ClaveUnidad="ACT" Descripcion="Servicio de transporte" ValorUnitario="${subtotal}" Importe="${subtotal}" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <${cpNs}:CartaPorte Version="${cpVersion}"${idCCP ? ` IdCCP="${idCCP}"` : ""} TranspInternac="${transpInternac}"${totalDistRec ? ` TotalDistRec="${totalDistRec}"` : ""}>
${ubicaciones.length > 0 ? `        <${cpNs}:Ubicaciones>\n${ubiXml}\n        </${cpNs}:Ubicaciones>` : ""}
${mercancias.length > 0 ? `        <${cpNs}:Mercancias>\n${merXml}\n        </${cpNs}:Mercancias>` : ""}
${autoXml}
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
  const detected = result.findings.find(f => f.code === "CARTA_PORTE_DETECTED")!;
  assertEqual(detected.severity, "INFO", "CARTA_PORTE_DETECTED debe ser INFO");
  assertTruthy(
    !result.findings.some(f => f.code === "CARTA_PORTE_MISSING_UBICACIONES"),
    "No debe existir CARTA_PORTE_MISSING_UBICACIONES",
  );
  assertTruthy(
    !result.findings.some(f => f.code === "CARTA_PORTE_MISSING_MERCANCIAS"),
    "No debe existir CARTA_PORTE_MISSING_MERCANCIAS",
  );
  assertTruthy(
    !result.findings.some(f => f.code === "CARTA_PORTE_ORIGIN_DESTINATION_REVIEW"),
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
  const ubiFinding = result.findings.find(f => f.code === "CARTA_PORTE_MISSING_UBICACIONES")!;
  assertEqual(ubiFinding.severity, "WARNING", "CARTA_PORTE_MISSING_UBICACIONES debe ser WARNING");
  const merFinding = result.findings.find(f => f.code === "CARTA_PORTE_MISSING_MERCANCIAS")!;
  assertEqual(merFinding.severity, "WARNING", "CARTA_PORTE_MISSING_MERCANCIAS debe ser WARNING");
}

// AC) Carta Porte tipo comprobante inesperado
async function testCartaPorteTipoInesperado(): Promise<void> {
  const xml = buildCartaPorteXml({ tipoComprobante: "P" });
  const result = analyzeCfdi(xml, "carta-porte-tipo-pago.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE");
  const finding = result.findings.find(f => f.code === "CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE")!;
  assertEqual(finding.severity, "WARNING", "CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE debe ser WARNING");
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
  const finding = result.findings.find(f => f.code === "CARTA_PORTE_TRASLADO_TOTAL_NOT_ZERO")!;
  assertEqual(finding.severity, "WARNING", "CARTA_PORTE_TRASLADO_TOTAL_NOT_ZERO debe ser WARNING");
}

// AE) Carta Porte mercancía inválida
async function testCartaPorteMercanciaInvalida(): Promise<void> {
  const xml = buildCartaPorteXml({
    mercancias: [
      { cantidad: "0", pesoEnKg: "-5.00" },
    ],
  });
  const result = analyzeCfdi(xml, "carta-porte-mercancia-invalida.xml");

  assertIncludesFinding(result.findings, "CARTA_PORTE_MERCANCIA_MISSING_BIENES_TRANSP");
  assertIncludesFinding(result.findings, "CARTA_PORTE_MERCANCIA_INVALID_QUANTITY");
  assertIncludesFinding(result.findings, "CARTA_PORTE_MERCANCIA_INVALID_WEIGHT");
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
  await runCase("AB) Carta Porte sin ubicaciones/mercancías", testCartaPorteSinUbicacionesMercancias);
  await runCase("AC) Carta Porte tipo comprobante inesperado", testCartaPorteTipoInesperado);
  await runCase("AD) Carta Porte traslado con total distinto de cero", testCartaPorteTrasladoTotalNoCero);
  await runCase("AE) Carta Porte mercancía inválida", testCartaPorteMercanciaInvalida);

  printSummary();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Error fatal en la suite:", err);
  process.exitCode = 1;
});
