import { XMLParser } from "fast-xml-parser";
const p = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: false,
  parseTagValue: false,
  parseAttributeValue: false,
});
const x = '<?xml version="1.0"?><r xmlns:c="urn:c"><c:CartaPorte V="3.1"><c:Autotransporte/></c:CartaPorte></r>';
const o = p.parse(x);
const cp = o.r["c:CartaPorte"];
console.log("keys:", Object.keys(cp));
console.log("hasAuto:", !!cp["c:Autotransporte"]);
