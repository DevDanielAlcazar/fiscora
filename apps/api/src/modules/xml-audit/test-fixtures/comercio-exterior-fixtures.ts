import type { SyntheticFixtureCase } from "./xml-fixture.types.js";

export const COMERCIO_EXTERIOR_SYNTHETIC_FIXTURES: SyntheticFixtureCase[] = [
  {
    id: "CE_SYNTH_OK_BASE",
    name: "Comercio Exterior base válido",
    kind: "COMERCIO_EXTERIOR",
    description: "CFDI con Complemento Comercio Exterior",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I" Exportacion="02" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="USD" TipoCambio="18.00">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="G01" ResidenciaFiscal="USA" NumRegIdTrib="123456789"/>
  <cfdi:Complemento>
    <cce20:ComercioExterior xmlns:cce20="http://www.sat.gob.mx/ComercioExterior20" Version="2.0" TipoOperacion="01" TotalUSD="5.56">
      <cce20:Mercancias>
        <cce20:Mercancia NoIdentificacion="1" FraccionArancelaria="12345678" CantidadAduana="1" UnidadAduana="01" ValorUnitarioAduana="5.56" ValorDolares="5.56"/>
      </cce20:Mercancias>
    </cce20:ComercioExterior>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: [],
    expectedDocumentKind: "CFDI",
    tags: ["comercio-exterior", "valido"],
  },
  {
    id: "CE_SYNTH_EXPORTACION_02_WITHOUT_CCE",
    name: "Exportación 02 sin CCE",
    kind: "COMERCIO_EXTERIOR",
    description: "CFDI Exportacion=02 sin complemento Comercio Exterior",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I" Exportacion="02" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="G01"/>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["EXPORTACION_WITHOUT_COMERCIO_EXTERIOR"],
    tags: ["comercio-exterior", "falta-complemento"],
  },
  {
    id: "CE_SYNTH_MISSING_TOTAL_USD",
    name: "CCE sin TotalUSD",
    kind: "COMERCIO_EXTERIOR",
    description: "Complemento CCE sin campo TotalUSD",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I" Exportacion="02" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="USD" TipoCambio="18.00">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="G01"/>
  <cfdi:Complemento>
    <cce20:ComercioExterior xmlns:cce20="http://www.sat.gob.mx/ComercioExterior20" Version="2.0" TipoOperacion="01">
      <cce20:Mercancias>
        <cce20:Mercancia NoIdentificacion="1" FraccionArancelaria="12345678" CantidadAduana="1" ValorDolares="5.56"/>
      </cce20:Mercancias>
    </cce20:ComercioExterior>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["COMERCIO_EXTERIOR_TOTALUSD_MISSING"],
    tags: ["comercio-exterior", "total-faltante"],
  },
  {
    id: "CE_SYNTH_INVALID_TIPO_CAMBIO_USD",
    name: "CCE TipoCambioUSD no positivo",
    kind: "COMERCIO_EXTERIOR",
    description: "TipoCambioUSD <= 0",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I" Exportacion="02" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="USD" TipoCambio="0">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="G01"/>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["COMERCIO_EXTERIOR_TIPOCAMBIOUSD_NON_POSITIVE"],
    tags: ["comercio-exterior", "tipo-cambio-invalido"],
  },
  {
    id: "CE_SYNTH_VALOR_DOLARES_MISMATCH",
    name: "CCE ValorDolares mismatch",
    kind: "COMERCIO_EXTERIOR",
    description: "ValorDolares no cuadra con cálculo",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I" Exportacion="02" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="USD" TipoCambio="18.00">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="G01"/>
  <cfdi:Complemento>
    <cce20:ComercioExterior xmlns:cce20="http://www.sat.gob.mx/ComercioExterior20" Version="2.0" TipoOperacion="01" TotalUSD="5.00">
      <cce20:Mercancias>
        <cce20:Mercancia NoIdentificacion="1" FraccionArancelaria="12345678" CantidadAduana="1" ValorUnitarioAduana="5.56" ValorDolares="10.00"/>
      </cce20:Mercancias>
    </cce20:ComercioExterior>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["COMERCIO_EXTERIOR_TOTALUSD_MISMATCH"],
    tags: ["comercio-exterior", "valor-mismatch"],
  },
  {
    id: "CE_SYNTH_CERT_ORIGEN_INVALID",
    name: "CE CertificadoOrigen inválido",
    kind: "COMERCIO_EXTERIOR",
    description: "CertificadoOrigen=1 sin NumCertificadoOrigen",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I" Exportacion="02" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="USD" TipoCambio="18.00">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="G01"/>
  <cfdi:Complemento>
    <cce20:ComercioExterior xmlns:cce20="http://www.sat.gob.mx/ComercioExterior20" Version="2.0" TipoOperacion="01" TotalUSD="5.56">
      <cce20:Mercancias>
        <cce20:Mercancia NoIdentificacion="1" FraccionArancelaria="12345678"/>
      </cce20:Mercancias>
    </cce20:ComercioExterior>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: [],
    tags: ["comercio-exterior", "certificado"],
  },
  {
    id: "CE_SYNTH_MERCANCIA_INCOMPLETE",
    name: "CE mercancía incompleta",
    kind: "COMERCIO_EXTERIOR",
    description: "Mercancía sin FraccionArancelaria",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I" Exportacion="02" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="USD" TipoCambio="18.00">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="G01"/>
  <cfdi:Complemento>
    <cce20:ComercioExterior xmlns:cce20="http://www.sat.gob.mx/ComercioExterior20" Version="2.0" TipoOperacion="01" TotalUSD="5.56">
      <cce20:Mercancias>
        <cce20:Mercancia NoIdentificacion="1" CantidadAduana="1"/>
      </cce20:Mercancias>
    </cce20:ComercioExterior>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["COMERCIO_EXTERIOR_MERCANCIA_FRACCION_MISSING"],
    tags: ["comercio-exterior", "fraccion"],
  },
  {
    id: "CE_SYNTH_RECEPTOR_EXTRANJERO_INCOMPLETE",
    name: "CE receptor extranjero sin NumRegIdTrib",
    kind: "COMERCIO_EXTERIOR",
    description: "Receptor sin NumRegIdTrib",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I" Exportacion="02" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="USD" TipoCambio="18.00">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="XEXX010101000" Nombre="Receptor" UsoCFDI="G01"/>
  <cfdi:Complemento>
    <cce20:ComercioExterior xmlns:cce20="http://www.sat.gob.mx/ComercioExterior20" Version="2.0" TipoOperacion="01" TotalUSD="5.56">
      <cce20:Mercancias>
        <cce20:Mercancia NoIdentificacion="1" FraccionArancelaria="12345678"/>
      </cce20:Mercancias>
    </cce20:ComercioExterior>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["COMERCIO_EXTERIOR_RECEPTOR_SIN_NUMREG"],
    tags: ["comercio-exterior", "receptor-extranjero"],
  },
];