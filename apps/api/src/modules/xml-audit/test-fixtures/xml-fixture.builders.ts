import type { SyntheticFixtureBuildOptions } from "./xml-fixture.types.js";

const SYNTHETIC_MARKER = "<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->";

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function buildBaseCfdiXml(options: SyntheticFixtureBuildOptions & { tipoDeComprobante?: string; includeTfd?: boolean }): string {
  const version = options.version ?? "4.0";
  const fecha = options.fecha ?? "2024-01-15T12:00:00";
  const folio = options.folio ?? "1";
  const serie = options.serie ? `Serie="${escapeXml(options.serie)}" ` : "";
  const tipo = options.tipoDeComprobante ?? "I";
  const emisorRfc = options.emisorRfc ?? "AAA010101AAA";
  const receptorRfc = options.receptorRfc ?? "XAXX010101000";
  const tipoDeComprobante = `TipoDeComprobante="${tipo}"`;

  const tfdSection = options.includeTfd
    ? `<cfdi:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="12345678-1234-1234-1234-123456789012" FechaTimbrado="${fecha}" NoCertificadoSAT="3000" SelloSAT="signature" SelloCFD="signature2" Version="1.1"/>
  </cfdi:Complemento>`
    : "";

  return `${SYNTHETIC_MARKER}
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/${version}" ${serie}Folio="${escapeXml(folio)}" Fecha="${fecha}" ${tipoDeComprobante} Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="${emisorRfc}" Nombre="Empresa de Prueba" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${receptorRfc}" Nombre="Receptor de Prueba" UsoCFDI="G01"/>
${tfdSection}
</cfdi:Comprobante>`;
}

export function buildCfdiWithComplement(options: SyntheticFixtureBuildOptions, complementXml: string): string {
  const version = options.version ?? "4.0";
  const fecha = options.fecha ?? "2024-01-15T12:00:00";
  const folio = options.folio ?? "1";
  const emisorRfc = options.emisorRfc ?? "AAA010101AAA";
  const receptorRfc = options.receptorRfc ?? "XAXX010101000";

  return `${SYNTHETIC_MARKER}
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/${version}" Folio="${escapeXml(folio)}" Fecha="${fecha}" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="${emisorRfc}" Nombre="Empresa de Prueba" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${receptorRfc}" Nombre="Receptor de Prueba" UsoCFDI="G01"/>
  <cfdi:Complemento>
    ${complementXml}
  </cfdi:Complemento>
</cfdi:Comprobante>`;
}

export function buildRetencionesXml(options: SyntheticFixtureBuildOptions & { complementXml?: string }): string {
  const folioInt = options.folio ?? "1";
  const emisorRfc = options.emisorRfc ?? "AAA010101AAA";

  const complementSection = options.complementXml
    ? `<cfdi:Complemento>
    ${options.complementXml}
  </cfdi:Complemento>`
    : "";

  return `${SYNTHETIC_MARKER}
<cfdi:Retenciones xmlns:cfdi="http://www.sat.gob.mx/retenciones" FolioInt="${escapeXml(folioInt)}" CveRetenc="01" FechaExp="2024-01-15T12:00:00" Sello="sig" Cert="MII..." NumCert="3000">
  <cfdi:Emisor Rfc="${emisorRfc}"/>
  <cfdi:Totales MontoTotOperacion="100.00" MontoTotRet="10.00"/>
  ${complementSection}
</cfdi:Retenciones>`;
}