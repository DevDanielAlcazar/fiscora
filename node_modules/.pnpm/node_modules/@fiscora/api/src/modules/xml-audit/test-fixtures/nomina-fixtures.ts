import type { SyntheticFixtureCase } from "./xml-fixture.types.js";

export const NOMINA_SYNTHETIC_FIXTURES: SyntheticFixtureCase[] = [
  {
    id: "NM_SYNTH_OK_BASE",
    name: "Nómina base válida",
    kind: "NOMINA_12",
    description: "CFDI Tipo N con complemento Nómina mínimo",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="N" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="N/A"/>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" Version="1.2" FechaPago="2024-01-15" FechaInicialPago="2024-01-01" FechaFinalPago="2024-01-15" NumDiasPagados="15">
      <nomina12:Receptor Curp="AAAA010101HDFABC00" NumEmpleado="1" TipoRegimen="605" PeriodicidadPago="01" ClaveEntFed="AGU"/>
      <nomina12:Percepciones TotalGravado="100.00" TotalExento="0.00">
        <nomina12:Percepcion TipoPercepcion="001" Clave="1" Concepto="Sueldo" ImporteGravado="100.00" ImporteExento="0.00"/>
      </nomina12:Percepciones>
    </nomina12:Nomina>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: [],
    expectedDocumentKind: "CFDI",
    tags: ["nomina", "valido"],
  },
  {
    id: "NM_SYNTH_WITHOUT_NOMINA_COMPLEMENT",
    name: "Tipo N sin complemento",
    kind: "NOMINA_12",
    description: "CFDI Tipo N sin complemento Nómina",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="N" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="N/A"/>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["NOMINA_CFDI_WITHOUT_NOMINA_COMPLEMENT"],
    tags: ["nomina", "falta-complemento"],
  },
  {
    id: "NM_SYNTH_CURRENCY_NOT_MXN",
    name: "Nómina moneda no MXN",
    kind: "NOMINA_12",
    description: "Nómina con moneda distinta de MXN",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="N" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="USD">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="N/A"/>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" Version="1.2" FechaPago="2024-01-15" FechaInicialPago="2024-01-01" FechaFinalPago="2024-01-15" NumDiasPagados="15">
      <nomina12:Receptor Curp="AAAA010101HDFABC00" NumEmpleado="1" TipoRegimen="605" PeriodicidadPago="01" ClaveEntFed="AGU"/>
    </nomina12:Nomina>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["NOMINA_MONEDA_NOT_MXN"],
    tags: ["nomina", "moneda-invalida"],
  },
  {
    id: "NM_SYNTH_INVALID_PAYMENT_DATES",
    name: "Nómina fechas pago inválidas",
    kind: "NOMINA_12",
    description: "FechaInicialPago mayor que FechaFinalPago",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="N" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="N/A"/>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" Version="1.2" FechaPago="2024-01-15" FechaInicialPago="2024-01-31" FechaFinalPago="2024-01-01" NumDiasPagados="15">
      <nomina12:Receptor Curp="AAAA010101HDFABC00" NumEmpleado="1" TipoRegimen="605" PeriodicidadPago="01" ClaveEntFed="AGU"/>
    </nomina12:Nomina>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["NOMINA_FECHAINI_MAYOR_FECHAFIN"],
    tags: ["nomina", "fechas-invalidas"],
  },
  {
    id: "NM_SYNTH_PERCEPCIONES_MISMATCH",
    name: "Nómina percepciones total mismatch",
    kind: "NOMINA_12",
    description: "TotalGravado no cuadra con suma de percepciones",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="N" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="N/A"/>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" Version="1.2" FechaPago="2024-01-15" FechaInicialPago="2024-01-01" FechaFinalPago="2024-01-15" NumDiasPagados="15">
      <nomina12:Receptor Curp="AAAA010101HDFABC00" NumEmpleado="1" TipoRegimen="605" PeriodicidadPago="01" ClaveEntFed="AGU"/>
      <nomina12:Percepciones TotalGravado="200.00" TotalExento="0.00">
        <nomina12:Percepcion TipoPercepcion="001" Clave="1" Concepto="Sueldo" ImporteGravado="100.00" ImporteExento="0.00"/>
      </nomina12:Percepciones>
    </nomina12:Nomina>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["NOMINA_PERCEPCIONES_TOTALGRAVADO_MISMATCH"],
    tags: ["nomina", "total-mismatch"],
  },
  {
    id: "NM_SYNTH_RECEPTOR_INCOMPLETE",
    name: "Nómina receptor incompleto",
    kind: "NOMINA_12",
    description: "Receptor sin TipoRegimen",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="N" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="N/A"/>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" Version="1.2" FechaPago="2024-01-15">
      <nomina12:Receptor NumEmpleado="1"/>
    </nomina12:Nomina>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: [],
    tags: ["nomina", "receptor-incompleto"],
  },
  {
    id: "NM_SYNTH_DEDUCCIONES_MISMATCH",
    name: "Nómina deducciones mismatch",
    kind: "NOMINA_12",
    description: "TotalOtrasDeducciones no cuadra",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="N" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="N/A"/>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" Version="1.2" FechaPago="2024-01-15" FechaInicialPago="2024-01-01" FechaFinalPago="2024-01-15" NumDiasPagados="15">
      <nomina12:Receptor Curp="AAAA010101HDFABC00" NumEmpleado="1" TipoRegimen="605" PeriodicidadPago="01" ClaveEntFed="AGU"/>
      <nomina12:Percepciones TotalGravado="100.00"/>
      <nomina12:Deducciones TotalOtrasDeducciones="50.00">
        <nomina12:Deduccion TipoDeduccion="001" Importe="25.00"/>
      </nomina12:Deducciones>
    </nomina12:Nomina>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: [],
    tags: ["nomina", "deducciones-mismatch"],
  },
  {
    id: "NM_SYNTH_SUBSIDIO_INCONSISTENT",
    name: "Nómina subsidio inconsistente",
    kind: "NOMINA_12",
    description: "SubsidioAlEmpleo sin importe pero con tipo",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="N" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="N/A"/>
  <cfdi:Complemento>
    <nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" Version="1.2" FechaPago="2024-01-15" FechaInicialPago="2024-01-01" FechaFinalPago="2024-01-15" NumDiasPagados="15">
      <nomina12:Receptor Curp="AAAA010101HDFABC00" NumEmpleado="1" TipoRegimen="605" PeriodicidadPago="01" ClaveEntFed="AGU"/>
      <nomina12:Percepciones TotalGravado="100.00"/>
      <nomina12:OtrosPagos>
        <nomina12:OtroPago TipoOtroPago="002"/>
      </nomina12:OtrosPagos>
    </nomina12:Nomina>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: [],
    tags: ["nomina", "subsidio"],
  },
];