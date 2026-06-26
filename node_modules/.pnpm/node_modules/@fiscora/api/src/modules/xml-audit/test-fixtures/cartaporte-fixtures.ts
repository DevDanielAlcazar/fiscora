import type { SyntheticFixtureCase } from "./xml-fixture.types.js";

export const CARTA_PORTE_SYNTHETIC_FIXTURES: SyntheticFixtureCase[] = [
  {
    id: "CP_SYNTH_OK_BASE",
    name: "Carta Porte base válida",
    kind: "CFDI_BASE",
    description: "CFDI con Carta Porte mínima",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="T" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="T01"/>
  <cfdi:Complemento>
    <cartaporte30:CartaPorte xmlns:cartaporte30="http://www.sat.gob.mx/CartaPorte30" Version="3.0" TranspInternac="No" TotalDistRec="100.00">
      <cartaporte30:Ubicaciones>
        <cartaporte30:Ubicacion TipoUbicacion="Origen" FechaHoraSalidaLlegada="2024-01-15T12:00:00">
          <cartaporte30:Domicilio CodigoPostal="01000" Estado="AGU" Pais="MEX"/>
        </cartaporte30:Ubicacion>
      </cartaporte30:Ubicaciones>
      <cartaporte30:Mercancias NumTotalMercancias="1" PesoBrutoTotal="100.00">
        <cartaporte30:Mercancia BienesTransp="12345678" Descripcion="Mercancia" Cantidad="1" ClaveUnidad="ACT" PesoNeto="100.00"/>
      </cartaporte30:Mercancias>
    </cartaporte30:CartaPorte>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: [],
    expectedDocumentKind: "CFDI",
    tags: ["carta-porte", "valido"],
  },
  {
    id: "CP_SYNTH_INTERNACIONAL_WITHOUT_PAIS_OR_VIA",
    name: "Carta Porte internacional sin país/vía",
    kind: "CARTA_PORTE",
    description: "TranspInternac Sí sin país/vía entrada-salida",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="T" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="T01"/>
  <cfdi:Complemento>
    <cartaporte30:CartaPorte xmlns:cartaporte30="http://www.sat.gob.mx/CartaPorte30" Version="3.0" TranspInternac="Si">
      <cartaporte30:Ubicaciones>
        <cartaporte30:Ubicacion TipoUbicacion="Origen" FechaHoraSalidaLlegada="2024-01-15T12:00:00">
          <cartaporte30:Domicilio CodigoPostal="01000"/>
        </cartaporte30:Ubicacion>
      </cartaporte30:Ubicaciones>
    </cartaporte30:CartaPorte>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["CARTA_PORTE_INTERNACIONAL_SIN_PAIS_VIA"],
    tags: ["carta-porte", "internacional"],
  },
  {
    id: "CP_SYNTH_TOTAL_DIST_MISMATCH",
    name: "Carta Porte distancia mismatch",
    kind: "CARTA_PORTE",
    description: "TotalDistRec no cuadra con suma",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="T" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="T01"/>
  <cfdi:Complemento>
    <cartaporte30:CartaPorte xmlns:cartaporte30="http://www.sat.gob.mx/CartaPorte30" Version="3.0" TranspInternac="No" TotalDistRec="1000.00">
      <cartaporte30:Ubicaciones>
        <cartaporte30:Ubicacion TipoUbicacion="Origen" DistanciaRecorrida="100.00"/>
      </cartaporte30:Ubicaciones>
    </cartaporte30:CartaPorte>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["CARTA_PORTE_TOTALDISTREC_MISMATCH"],
    tags: ["carta-porte", "distancia"],
  },
  {
    id: "CP_SYNTH_MERCANCIAS_MISMATCH",
    name: "Carta Porte mercancías mismatch",
    kind: "CARTA_PORTE",
    description: "NumTotalMercancias distinto al conteo real",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="T" Total="100.00" Subtotal="100.00" Sello="sig" Certificado="MII..." NoCertificado="3000" Moneda="MXN">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="Empresa" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="BBB010101BBB" Nombre="Receptor" UsoCFDI="T01"/>
  <cfdi:Complemento>
    <cartaporte30:CartaPorte xmlns:cartaporte30="http://www.sat.gob.mx/CartaPorte30" Version="3.0" TranspInternac="No" TotalDistRec="100.00">
      <cartaporte30:Mercancias NumTotalMercancias="5" PesoBrutoTotal="100.00">
        <cartaporte30:Mercancia BienesTransp="12345678" Descripcion="Mercancia" Cantidad="1" ClaveUnidad="ACT"/>
      </cartaporte30:Mercancias>
    </cartaporte30:CartaPorte>
  </cfdi:Complemento>
</cfdi:Comprobante>`,
    expectedFindingCodes: ["CARTA_PORTE_NUMMERCANCIAS_MISMATCH"],
    tags: ["carta-porte", "mercancias"],
  },
];