import { detectCfdiType } from "../detect-cfdi-type.js";
/**
 * Validates basic XML structure and CFDI requirements (attributes, schema location, etc.).
 * Returns a typed placeholder audit report.
 */
export function validateXmlStructure(xmlContent) {
    const findings = [];
    const type = detectCfdiType(xmlContent);
    // Check simple structure placeholders
    if (!xmlContent.trim().startsWith("<") || !xmlContent.trim().endsWith(">")) {
        findings.push({
            code: "INVALID_XML_STRUCTURE",
            message: "El contenido no parece ser un documento XML válido",
            severity: "ERROR",
        });
    }
    // Look for CFDI 4.0 or 3.3 attributes
    const isCfdi4 = xmlContent.includes('Version="4.0"') || xmlContent.includes("Version='4.0'");
    const isCfdi33 = xmlContent.includes('Version="3.3"') || xmlContent.includes("Version='3.3'");
    if (!isCfdi4 && !isCfdi33) {
        findings.push({
            code: "UNKNOWN_CFDI_VERSION",
            message: "No se pudo determinar la versión del CFDI (se soporta 3.3 y 4.0)",
            severity: "WARNING",
        });
    }
    return {
        uuid: "123e4567-e89b-12d3-a456-426614174000",
        isValid: findings.filter((f) => f.severity === "ERROR").length === 0,
        documentType: type,
        rfcEmisor: "XAXX010101000",
        rfcReceptor: "XAXX010101000",
        fecha: new Date().toISOString(),
        subTotal: 100.0,
        total: 116.0,
        findings,
        rawMetadata: {
            version: isCfdi4 ? "4.0" : isCfdi33 ? "3.3" : "unknown",
        },
    };
}
//# sourceMappingURL=basic-xml-validator.js.map