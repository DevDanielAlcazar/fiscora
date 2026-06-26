import type { SyntheticFixtureCase } from "./xml-fixture.types.js";

const pagos20Ok = `<pago20:Pago xmlns:pago20="http://www.sat.gob.mx/Pagos20" FechaPago="2024-01-15T12:00:00" FormaDePagoP="01" MonedaP="MXN" Monto="100.00">
  <pago20:DoctoRelacionado IdDocumento="12345678-1234-1234-1234-123456789012" Serie="A" Folio="1" MonedaDR="MXN" NumParcialidad="1" ImpSaldoAnt="100.00" ImpPagado="100.00" ImpSaldoInsoluto="0.00"/>
</pago20:Pago>`;

const pagos20MissingPayment = `<pago20:Pago xmlns:pago20="http://www.sat.gob.mx/Pagos20" FechaPago="2024-01-15T12:00:00" FormaDePagoP="01" MonedaP="MXN" Monto="100.00">
</pago20:Pago>`;

const pagos20MissingFormaPago = `<pago20:Pago xmlns:pago20="http://www.sat.gob.mx/Pagos20" FechaPago="2024-01-15T12:00:00" MonedaP="MXN" Monto="100.00">
  <pago20:DoctoRelacionado IdDocumento="12345678-1234-1234-1234-123456789012" NumParcialidad="1" ImpSaldoAnt="100.00" ImpPagado="100.00"/>
</pago20:Pago>`;

const pagos20ForeignCurrency = `<pago20:Pago xmlns:pago20="http://www.sat.gob.mx/Pagos20" FechaPago="2024-01-15T12:00:00" FormaDePagoP="01" MonedaP="USD" Monto="100.00">
  <pago20:DoctoRelacionado IdDocumento="12345678-1234-1234-1234-123456789012" MonedaDR="USD" NumParcialidad="1" ImpSaldoAnt="100.00" ImpPagado="100.00"/>
</pago20:Pago>`;

const pagos20InvalidBalance = `<pago20:Pago xmlns:pago20="http://www.sat.gob.mx/Pagos20" FechaPago="2024-01-15T12:00:00" FormaDePagoP="01" MonedaP="MXN" Monto="100.00">
  <pago20:DoctoRelacionado IdDocumento="12345678-1234-1234-1234-123456789012" NumParcialidad="1" ImpSaldoAnt="50.00" ImpPagado="100.00" ImpSaldoInsoluto="-50.00"/>
</pago20:Pago>`;

export const PAGOS_SYNTHETIC_FIXTURES: SyntheticFixtureCase[] = [
  {
    id: "PG_SYNTH_OK_BASE",
    name: "Pago 2.0 base válido",
    kind: "CFDI_BASE",
    description: "CFDI Tipo P con complemento Pago 2.0 completo",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="P" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa de Prueba" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor de Prueba" UsoCFDI="P01"/>
  <cfdi:Complemento>
    ${pagos20Ok}
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: [],
    expectedDocumentKind: "CFDI",
    tags: ["pago", "valido"],
  },
  {
    id: "PG_SYNTH_INCOMPLETE_PER_PAGO",
    name: "Pago 2.0 sin complemento",
    kind: "PAGOS_20",
    description: "CFDI Tipo P sin complemento Pago",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="P" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="P01"/>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["PAYMENT_COMPLEMENT_MISSING"],
    tags: ["pago", "falta-complemento"],
  },
  {
    id: "PG_SYNTH_INCOMPLETE_PER_DOCTO",
    name: "Pago sin DoctoRelacionado",
    kind: "PAGOS_20",
    description: "Pago con datos pero sin documento relacionado",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="P" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="P01"/>
  <cfdi:Complemento>
    ${pagos20MissingPayment}
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["PAYMENT_WITHOUT_RELATED_DOCUMENTS"],
    tags: ["pago", "docto-faltante"],
  },
  {
    id: "PG_SYNTH_MISSING_FORMA_PAGO_P",
    name: "Pago sin FormaDePagoP",
    kind: "PAGOS_20",
    description: "Pago sin FormaDePagoP",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="P" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="P01"/>
  <cfdi:Complemento>
    ${pagos20MissingFormaPago}
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["PAYMENT_MISSING_FORMA_PAGO"],
    tags: ["pago", "forma-pago"],
  },
  {
    id: "PG_SYNTH_FOREIGN_CURRENCY",
    name: "Pago moneda extranjera sin TipoCambio",
    kind: "PAGOS_20",
    description: "Pago con MonedaP USD sin TipoCambioP",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="P" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="P01"/>
  <cfdi:Complemento>
    ${pagos20ForeignCurrency}
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["PAYMENT_MISSING_TIPO_CAMBIO"],
    tags: ["pago", "moneda-extranjera"],
  },
  {
    id: "PG_SYNTH_INVALID_BALANCE",
    name: "Pago balance negativo",
    kind: "PAGOS_20",
    description: "ImpSaldoInsoluto negativo: pago excede saldo",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="P" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="XXX">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="P01"/>
  <cfdi:Complemento>
    ${pagos20InvalidBalance}
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["RELATED_DOCUMENT_BALANCE_NEGATIVE"],
    tags: ["pago", "balance-invalido"],
  },
];