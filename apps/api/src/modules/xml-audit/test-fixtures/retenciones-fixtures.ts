import type { SyntheticFixtureCase } from "./xml-fixture.types.js";

export const RETENCIONES_SYNTHETIC_FIXTURES: SyntheticFixtureCase[] = [
  {
    id: "RET_SYNTH_OK_BASE",
    name: "Retenciones base válido",
    kind: "RETENCIONES_20",
    description: "Documento Retenciones 2.0 básico parseable",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0" FolioInt="1" CveRetenc="01" FechaExp="2024-01-15T12:00:00" Sello="sig" Cert="MII..." NumCert="3000">
  <retenciones:Emisor RfcE="AAA010101AAA" NomDenRazSocE="Empresa"/>
  <retenciones:Receptor Nacionalidad="Nacional">
    <retenciones:Nacional RfcR="BBB010101BBB"/>
  </retenciones:Receptor>
  <retenciones:Totales MontoTotOperacion="100.00" MontoTotRet="10.00"/>
</retenciones:Retenciones>`,
    expectedFindingCodes: [],
    expectedDocumentKind: "RETENCIONES",
    tags: ["retenciones", "valido"],
  },
  {
    id: "RET_SYNTH_MISSING_CVE_RETENC",
    name: "Retenciones sin CveRetenc",
    kind: "RETENCIONES_20",
    description: "Documento Retenciones sin CveRetenc",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0" FolioInt="1" FechaExp="2024-01-15T12:00:00" Sello="sig" Cert="MII..." NumCert="3000">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
  <retenciones:Receptor Nacionalidad="Nacional">
    <retenciones:Nacional RfcR="BBB010101BBB"/>
  </retenciones:Receptor>
</retenciones:Retenciones>`,
    expectedFindingCodes: ["RETENCIONES_MISSING_CVE_RETENC"],
    tags: ["retenciones", "cve-faltante"],
  },
  {
    id: "RET_SYNTH_INVALID_FECHA_EXP",
    name: "Retenciones FechaExp inválida",
    kind: "RETENCIONES_20",
    description: "FechaExp no válida",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0" FolioInt="1" CveRetenc="01" FechaExp="fecha-invalida" Sello="sig" Cert="MII..." NumCert="3000">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
</retenciones:Retenciones>`,
    expectedFindingCodes: ["RETENCIONES_FECHA_EXP_INVALID"],
    tags: ["retenciones", "fecha-invalida"],
  },
  {
    id: "RET_SYNTH_TOTALES_MISMATCH",
    name: "Retenciones totales mismatch",
    kind: "RETENCIONES_20",
    description: "MontoTotOperacion no positivo",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0" FolioInt="1" CveRetenc="01" FechaExp="2024-01-15T12:00:00" Sello="sig" Cert="MII..." NumCert="3000">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
  <retenciones:Receptor Nacionalidad="Nacional">
    <retenciones:Nacional RfcR="BBB010101BBB"/>
  </retenciones:Receptor>
  <retenciones:Totales MontoTotOperacion="0.00"/>
</retenciones:Retenciones>`,
    expectedFindingCodes: ["RETENCIONES_MONTO_OPERACION_MISSING"],
    tags: ["retenciones", "total-mismatch"],
  },
  {
    id: "RET_SYNTH_RECEPTOR_NACIONAL_WITHOUT_RFC",
    name: "Retenciones receptor nacional sin RFC",
    kind: "RETENCIONES_20",
    description: "Nacional sin RFC",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0" FolioInt="1" CveRetenc="01" FechaExp="2024-01-15T12:00:00" Sello="sig" Cert="MII..." NumCert="3000">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
  <retenciones:Receptor Nacionalidad="Nacional"/>
</retenciones:Retenciones>`,
    expectedFindingCodes: [],
    tags: ["retenciones", "receptor-sin-rfc"],
  },
  {
    id: "RET_SYNTH_RECEPTOR_EXTRANJERO_INCOMPLETE",
    name: "Retenciones receptor extranjero sin NumRegIdTrib",
    kind: "RETENCIONES_20",
    description: "Extranjero sin NumRegIdTrib",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0" FolioInt="1" CveRetenc="01" FechaExp="2024-01-15T12:00:00" Sello="sig" Cert="MII..." NumCert="3000">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
  <retenciones:Receptor Nacionalidad="Extranjero"/>
</retenciones:Retenciones>`,
    expectedFindingCodes: [],
    tags: ["retenciones", "receptor-extranjero"],
  },
  {
    id: "RET_SYNTH_IMP_RETENIDOS_INCOMPLETE",
    name: "Retenciones impuestos incompleto",
    kind: "RETENCIONES_20",
    description: "ImpRetenidos sin MontoRet",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="2.0" FolioInt="1" CveRetenc="01" FechaExp="2024-01-15T12:00:00" Sello="sig" Cert="MII..." NumCert="3000">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
  <retenciones:Receptor Nacionalidad="Nacional">
    <retenciones:Nacional RfcR="BBB010101BBB"/>
  </retenciones:Receptor>
  <retenciones:Totales MontoTotOperacion="100.00"/>
  <retenciones:Complemento>
    <retenciones:ImpRetenidos>
      <retenciones:ImpRetenido BaseRet="100.00" ImpuestoRet="01"/>
    </retenciones:ImpRetenidos>
  </retenciones:Complemento>
</retenciones:Retenciones>`,
    expectedFindingCodes: [],
    tags: ["retenciones", "impuestos"],
  },
  {
    id: "RET_SYNTH_VERSION_INVALID",
    name: "Retenciones versión inválida",
    kind: "RETENCIONES_20",
    description: "Version no 2.0",
    xml: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->
<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/retenciones" Version="1.0" CveRetenc="01" FechaExp="2024-01-15T12:00:00" Sello="sig" Cert="MII..." NumCert="3000">
  <retenciones:Emisor RfcE="AAA010101AAA"/>
</retenciones:Retenciones>`,
    expectedFindingCodes: [],
    tags: ["retenciones", "version-invalida"],
  },
];