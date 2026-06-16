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
  type CfdiAnalysisResult,
  type Finding,
  type NormalizedXml,
  getFindingPriority,
  getFindingActionGroup,
  sanitizeEvidenceValue,
  sanitizeFindingEvidence,
  sanitizeFinding,
  limitFindings,
  toAnalysisResponse,
} from "./xml-audit.service.js";
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

// ─── Test Cases ──────────────────────────────────────────────────────────────

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

  const docsXml = docs
    .map(
      (d) =>
        `        <pago20:DoctoRelacionado${d.idDocumento ? ` IdDocumento="${d.idDocumento}"` : ""} Serie="A" Folio="1"${d.monedaDR ? ` MonedaDR="${d.monedaDR}"` : ""}${d.equivalenciaDR ? ` EquivalenciaDR="${d.equivalenciaDR}"` : ""}${d.numParcialidad ? ` NumParcialidad="${d.numParcialidad}"` : ""}${d.impSaldoAnt ? ` ImpSaldoAnt="${d.impSaldoAnt}"` : ""}${d.impPagado ? ` ImpPagado="${d.impPagado}"` : ""}${d.impSaldoInsoluto ? ` ImpSaldoInsoluto="${d.impSaldoInsoluto}"` : ""} ObjetoImpDR="01"/>`,
    )
    .join("\n");

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
  ubicaciones?: Array<{
    tipo: string;
    id?: string;
    rfc?: string;
    nombre?: string;
    fecha?: string;
    distancia?: string;
  }>;
  mercancias?: Array<{
    bienesTransp?: string;
    descripcion?: string;
    cantidad?: string;
    claveUnidad?: string;
    pesoEnKg?: string;
    valor?: string;
    moneda?: string;
  }>;
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
  const hasAutotransporte = opts?.hasAutotransporte ?? true;

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
      return `          <${cpNs}:Ubicacion TipoUbicacion="${u.tipo}"${idAttr}${rfcAttr}${nomAttr}${fechaAttr}${distAttr}/>`;
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
      return `          <${cpNs}:Mercancia${bt}${desc}${cant}${cu}${peso}${val}${mon}/>`;
    })
    .join("\n");

  const cpNsAttr = `xmlns:${cpNs}="${cpNsUrl}"`;
  const autoXml = hasAutotransporte ? `        <${cpNs}:Autotransporte/>` : "";

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

// ─── Nomina fixtures ───────────────────────────────────────────────────────────

const NOMINA_NS = 'xmlns:nomina12="http://www.sat.gob.mx/nomina12"';

function buildNominaXml(opts?: {
  tipoComprobante?: string;
  total?: string;
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
  percepciones?: Array<{
    tipo: string;
    clave: string;
    concepto: string;
    gravado: string;
    exento: string;
  }>;
  deducciones?: Array<{ tipo: string; clave: string; concepto: string; importe: string }>;
  otrosPagos?: Array<{ tipo: string; clave: string; concepto: string; importe: string }>;
  omitirPercepciones?: boolean;
}): string {
  const tipo = opts?.tipoComprobante ?? "I";
  const total = opts?.total ?? "15000.00";
  const version = opts?.version ?? "1.2";
  const tipoNomina = opts?.tipoNomina ?? "O";
  const fechaPago = opts?.fechaPago ?? "2024-07-15";
  const fechaInicialPago = opts?.fechaInicialPago ?? "2024-07-01";
  const fechaFinalPago = opts?.fechaFinalPago ?? "2024-07-15";
  const numDiasPagados = opts?.numDiasPagados ?? "15";
  const totalPercepciones = opts?.totalPercepciones ?? "15000.00";
  const totalDeducciones = opts?.totalDeducciones ?? "3000.00";
  const totalOtrosPagos = opts?.totalOtrosPagos ?? "0.00";
  const curp = opts?.receptorCurp ?? "ABCD123456HDFRRL09";
  const nss = opts?.receptorNss ?? "12345678901";
  const numEmpleado = opts?.receptorNumEmpleado ?? "EMP001";
  const depto = opts?.receptorDepto ?? "SISTEMAS";
  const puesto = opts?.receptorPuesto ?? "ANALISTA";
  const tipoContrato = opts?.receptorTipoContrato ?? "01";
  const tipoRegimen = opts?.receptorTipoRegimen ?? "02";
  const periodicidad = opts?.receptorPeriodicidadPago ?? "02";
  const salBase = opts?.receptorSalarioBase ?? "500.00";
  const salDiario = opts?.receptorSalarioDiario ?? "520.00";
  const claveEdofed = opts?.receptorClaveEntFed ?? "CDMX";

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
  }> = [];

  const percList = opts?.percepciones ?? defaultPercepciones;
  const dedList = opts?.deducciones ?? defaultDeducciones;
  const opList = opts?.otrosPagos ?? defaultOtrosPagos;

  const percepcionesXml = opts?.omitirPercepciones
    ? ""
    : `        <nomina12:Percepciones TotalSueldos="${totalPercepciones}">
${percList.map((p) => `          <nomina12:Percepcion TipoPercepcion="${p.tipo}" Clave="${p.clave}" Concepto="${p.concepto}" ImporteGravado="${p.gravado}" ImporteExento="${p.exento}"/>`).join("\n")}
        </nomina12:Percepciones>`;

  const deduccionesXml =
    dedList.length > 0
      ? `        <nomina12:Deducciones TotalOtrasDeducciones="${totalDeducciones}">
${dedList.map((d) => `          <nomina12:Deduccion TipoDeduccion="${d.tipo}" Clave="${d.clave}" Concepto="${d.concepto}" Importe="${d.importe}"/>`).join("\n")}
        </nomina12:Deducciones>`
      : "";

  const otrosPagosXml =
    opList.length > 0
      ? `        <nomina12:OtrosPagos>
${opList.map((o) => `          <nomina12:OtroPago TipoOtroPago="${o.tipo}" Clave="${o.clave}" Concepto="${o.concepto}" Importe="${o.importe}"/>`).join("\n")}
        </nomina12:OtrosPagos>`
      : "";

  const typeLabel =
    tipo === "I" ? "Ingreso" : tipo === "N" ? "Nómina" : tipo === "P" ? "Pago" : tipo;

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${NOMINA_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="N" Folio="1" Fecha="2024-07-01T10:00:00" FormaPago="99" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="${total}" Moneda="MXN" Total="${total}" TipoDeComprobante="${tipo}" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="01" Sello="abc">
  <cfdi:Emisor Rfc="EKU9003173C9" Nombre="EMPRESA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XAXX010101001" Nombre="TRABAJADOR SA DE CV" DomicilioFiscalReceptor="12345" RegimenFiscalReceptor="608" UsoCFDI="S01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111505" Cantidad="1" ClaveUnidad="ACT" Descripcion="Nómina" ValorUnitario="${total}" Importe="${total}" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <nomina12:Nomina Version="${version}" TipoNomina="${tipoNomina}" FechaPago="${fechaPago}" FechaInicialPago="${fechaInicialPago}" FechaFinalPago="${fechaFinalPago}" NumDiasPagados="${numDiasPagados}" TotalPercepciones="${totalPercepciones}" TotalDeducciones="${totalDeducciones}" TotalOtrosPagos="${totalOtrosPagos}">
      <nomina12:Receptor CURP="${curp}" NumSeguridadSocial="${nss}" NumEmpleado="${numEmpleado}"${depto ? ` Departamento="${depto}"` : ""}${puesto ? ` Puesto="${puesto}"` : ""}${tipoContrato ? ` TipoContrato="${tipoContrato}"` : ""}${tipoRegimen ? ` TipoRegimen="${tipoRegimen}"` : ""}${periodicidad ? ` PeriodicidadPago="${periodicidad}"` : ""}${salBase ? ` SalarioBaseCotApor="${salBase}"` : ""}${salDiario ? ` SalarioDiarioIntegrado="${salDiario}"` : ""}${claveEdofed ? ` ClaveEntFed="${claveEdofed}"` : ""}/>
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
  version?: string;
  tipoOperacion?: string;
  claveDePedimento?: string;
  incoterm?: string;
  moneda?: string;
  totalUSD?: string;
  omitirComplemento?: boolean;
}): string {
  const tipo = opts?.tipoComprobante ?? "I";
  const total = opts?.total ?? "1000.00";
  const version = opts?.version ?? "1.1";
  const tipoOperacion = opts?.tipoOperacion ?? "2";
  const claveDePedimento = opts?.claveDePedimento ?? "A1";
  const incoterm = opts?.incoterm ?? "FOB";
  const moneda = opts?.moneda ?? "USD";
  const totalUSD = opts?.totalUSD ?? "1000.00";

  const complementContent = opts?.omitirComplemento
    ? ""
    : `<cce11:ComercioExterior ${CCE11_NS} Version="${version}" TipoOperacion="${tipoOperacion}"${claveDePedimento ? ` ClaveDePedimento="${claveDePedimento}"` : ""}${incoterm ? ` Incoterm="${incoterm}"` : ""}${totalUSD ? ` TotalUSD="${totalUSD}"` : ""}/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante ${CFDI_4_NS} ${XSI_NS} ${SCHEMA_LOCATION} Version="4.0" Serie="A" Folio="123" Fecha="2024-01-15T12:00:00" FormaPago="01" NoCertificado="00001000000500000000" Certificado="abc" SubTotal="1000.00" Moneda="${moneda}" Total="${total}" TipoDeComprobante="${tipo}" MetodoPago="PPD" LugarExpedicion="12345" Exportacion="02">
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
  assertEqual(result.findings.filter((f) => f.code === "IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISMATCH").length, 0, "no debe haber mismatch retenciones");
  assertEqual(result.findings.filter((f) => f.code === "IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISMATCH").length, 0, "no debe haber mismatch traslados");
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
  const finding = result.findings.find((f) => f.code === "IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISMATCH")!;
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
  const finding = result.findings.find((f) => f.code === "IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISMATCH")!;
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
const RET_SL = 'xsi:schemaLocation="http://www.sat.gob.mx/esquemas/retencionpago/1 http://www.sat.gob.mx/sitio_internet/esquemas/retencionpago/1/retencionpagov2.xsd"';

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
  const attr = opts?.attrsOverride ??
    `Version="2.0" FolioInt="RET-2024-001" FechaExp="2024-01-15T12:00:00" CveRetenc="01" DescRetenc="Retenciones" LugarExpRetenc="12345" Sello="abc" NumCert="00001000000500000000" Cert="def"`;
  const emisor = opts?.emisor ?? `<retenciones:Emisor RfcE="EKU9003173C9" NomDenRazSocE="EMPRESA SA DE CV" CURPE="XXXX000000HXXX"/>`;
  const receptor = opts?.receptor ?? `<retenciones:Receptor Nacionalidad="Nacional"><retenciones:Nacional RfcR="XAXX010101000" NomDenRazSocR="CLIENTE SA DE CV" CURPR="XXXX000000HXXA"/></retenciones:Receptor>`;
  const periodo = opts?.periodo ?? `<retenciones:Periodo MesIni="01" MesFin="01" Ejerc="2024"/>`;
  const totales = opts?.totales ?? `<retenciones:Totales MontoTotOperacion="10000.00" MontoTotGrav="8000.00" MontoTotExent="2000.00" MontoTotRet="1600.00"><retenciones:ImpRetenidos><retenciones:ImpRetenido BaseRet="8000.00" Impuesto="001" MontoRet="1600.00" TipoPagoRet="Pago definitivo"/></retenciones:ImpRetenidos></retenciones:Totales>`;
  const complemento = opts?.complemento ?? `<retenciones:Complemento><tfd:TimbreFiscalDigital ${TFD_NS} Version="1.1" UUID="da000000-0000-0000-0000-000000000000" FechaTimbrado="2024-01-15T12:30:00" RfcProvCertif="SAT970701NN3" SelloCFD="abc" SelloSAT="def" NoCertificadoSAT="00001000000500000000"/></retenciones:Complemento>`;
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
  assertEqual(result.leyendasFiscales!.leyendas[0].disposicionFiscal, "Artículo 1", "disposicionFiscal debe coincidir");
  assertEqual(result.leyendasFiscales!.leyendas[0].norma, "LISR", "norma debe coincidir");
  assertEqual(result.leyendasFiscales!.leyendas[0].textoLeyenda, "Artículo 1, fracción III de la LISR aplicable al período.", "textoLeyenda debe coincidir");
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
  assertEqual(result.donatarias!.fechaAutorizacion, "2024-01-01", "fechaAutorizacion debe coincidir");
  const hasMissingNoAut = result.findings.some((f) => f.code === "DONATARIAS_MISSING_NO_AUTORIZACION");
  assertEqual(hasMissingNoAut, false, "no debe tener DONATARIAS_MISSING_NO_AUTORIZACION");
  const hasMissingFecha = result.findings.some((f) => f.code === "DONATARIAS_MISSING_FECHA_AUTORIZACION");
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
  assertEqual(result.retenciones!.cveRetenc, "01", "cveRetenc debe coincidir");
  assertEqual(result.retenciones!.descRetenc, "Retenciones", "descRetenc debe coincidir");
  assertEqual(result.retenciones!.lugarExpRetenc, "12345", "lugarExpRetenc debe coincidir");
  assertEqual(result.retenciones!.uuid, "da000000-0000-0000-0000-000000000000", "uuid debe coincidir");
  assertTruthy(result.retenciones!.emisor, "emisor debe existir");
  assertEqual(result.retenciones!.emisor!.rfcEmisor, "EKU9003173C9", "rfcEmisor debe coincidir");
  assertTruthy(result.retenciones!.receptor, "receptor debe existir");
  assertEqual(result.retenciones!.receptor!.nacionalidad, "Nacional", "nacionalidad debe coincidir");
  assertEqual(result.retenciones!.receptor!.rfcReceptor, "XAXX010101000", "rfcReceptor debe coincidir");
  assertTruthy(result.retenciones!.periodo, "periodo debe existir");
  assertEqual(result.retenciones!.periodo!.mesIni, "01", "mesIni debe coincidir");
  assertEqual(result.retenciones!.periodo!.mesFin, "01", "mesFin debe coincidir");
  assertEqual(result.retenciones!.periodo!.ejercicio, "2024", "ejercicio debe coincidir");
  assertTruthy(result.retenciones!.totales, "totales debe existir");
  assertEqual(result.retenciones!.totales!.montoTotOperacion, "10000.00", "montoTotOperacion debe coincidir");
  assertEqual(result.retenciones!.totales!.montoTotRet, "1600.00", "montoTotRet debe coincidir");
  assertEqual(result.retenciones!.totales!.impuestosRetenidos.length, 1, "debe tener 1 impuesto retenido");
  assertIncludesFinding(result.findings, "RETENCIONES_DOCUMENT_DETECTED");
  const warns = result.findings.filter((f) => f.severity === "WARNING" || f.severity === "CRITICAL");
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
  assertEqual(result.retenciones!.receptor!.nacionalidad, "Extranjero", "nacionalidad debe ser Extranjero");
  assertEqual(result.retenciones!.receptor!.numRegIdTrib, "EXT-12345", "numRegIdTrib debe coincidir");
  const hasJ = result.findings.some((f) => f.code === "RETENCIONES_RECEPTOR_NACIONAL_MISSING_RFC");
  assertEqual(hasJ, false, "no debe tener RETENCIONES_RECEPTOR_NACIONAL_MISSING_RFC (es extranjero)");
  const hasK = result.findings.some((f) => f.code === "RETENCIONES_RECEPTOR_EXTRANJERO_MISSING_NUM_REG_ID_TRIB");
  assertEqual(hasK, false, "no debe tener RETENCIONES_RECEPTOR_EXTRANJERO_MISSING_NUM_REG_ID_TRIB (tiene NumRegIdTrib)");
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
  assertEqual(group, "Revisar referencias operativas", "ADDENDA STRUCTURE debe agrupar en referencias operativas");
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
  assertEqual(result[20] as string, "[truncated 30 additional items]", "debe incluir marcador de truncado");
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
  assertEqual(response.payloadPolicy!.evidenceMaxStringLength > 0, true, "evidenceMaxStringLength debe ser positivo");
  assertEqual(response.payloadPolicy!.findingsMaxTotal > 0, true, "findingsMaxTotal debe ser positivo");
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
  await runCase("CC) Comercio Exterior tipo operación inválido", testComercioExteriorTipoOperacionInvalido);
  await runCase("CD) Comercio Exterior versión inválida", testComercioExteriorVersionInvalida);
  await runCase("CE) Comercio Exterior tipo operación faltante", testComercioExteriorSinTipoOperacion);
  await runCase("CF) Comercio Exterior TotalUSD mismatch", testComercioExteriorTotalUSDMismatch);
  await runCase("CG) Comercio Exterior versión faltante", testComercioExteriorVersionFaltante);
  await runCase("CH) Comercio Exterior complemento vacío", testComercioExteriorComplementoVacio);
  await runCase("CI) Impuestos Locales válido base", testImpuestosLocalesValidoBase);
  await runCase("CJ) Impuestos Locales total retenciones mismatch", testImpuestosLocalesTotalRetencionesMismatch);
  await runCase("CK) Impuestos Locales total traslados mismatch", testImpuestosLocalesTotalTrasladosMismatch);
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

  printSummary();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Error fatal en la suite:", err);
  process.exitCode = 1;
});
