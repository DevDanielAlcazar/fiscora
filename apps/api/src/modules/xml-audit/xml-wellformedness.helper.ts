export interface XmlWellFormednessResult {
  isWellFormed: boolean;
  errorCode?: string;
  message?: string;
  line?: number;
  column?: number;
  evidence?: Record<string, unknown>;
  hasMultipleRootElements?: boolean;
  hasContentAfterRoot?: boolean;
  hasDuplicateComprobanteClose?: boolean;
  hasComplementAfterComprobanteClose?: boolean;
}

const SYNTHETIC_MARKER = "SYNTHETIC_TEST_ONLY";

export function validateXmlWellFormedness(xml: string): XmlWellFormednessResult {
  const cleanXml = xml.includes(SYNTHETIC_MARKER) ? xml : xml.replace(/<\?xml[^?]*\?>\s*/i, "");

  const rootCloseMatch = cleanXml.match(/<cfdi:Comprobante[^>]*>[\s\S]*<\/cfdi:Comprobante>/i);
  const rootCloseIdx = rootCloseMatch ? cleanXml.indexOf(rootCloseMatch[0]) + rootCloseMatch[0].length : -1;

  if (rootCloseIdx > 0 && rootCloseIdx < cleanXml.length) {
    const afterRoot = cleanXml.slice(rootCloseIdx);
    const afterTrimmed = afterRoot.replace(/^\s+$/, "").replace(/^\s+$/m, "");

    if (afterTrimmed.length > 0) {
      const hasComplementAfter = /<cfdi:Complemento|<\/cfdi:Comprobante/i.test(afterTrimmed);
      const hasDuplicateClose = /<\/cfdi:Comprobante>/i.test(afterTrimmed);
      const hasMultipleRoot = /<cfdi:Comprobante[^>]*>|<retenciones:Retenciones[^>]*>/i.test(afterTrimmed);

      const evidence: Record<string, unknown> = {
        contentAfterRootSnippet: afterTrimmed.slice(0, 80),
      };

      if (hasComplementAfter) {
        evidence.patternDetected = "Complemento después del cierre de Comprobante";
      }
      if (hasDuplicateClose) {
        evidence.patternDetected = "Comprobante duplicado después del cierre";
      }
      if (hasMultipleRoot) {
        evidence.patternDetected = "Múltiples raíces detectadas";
      }

      return {
        isWellFormed: false,
        errorCode: "XML_MALFORMED_CONTENT_AFTER_ROOT",
        message:
          "El XML contiene contenido después del cierre del nodo raíz, lo cual indica documento mal formado. No se puede analizar el CFDI de forma segura.",
        evidence,
        hasMultipleRootElements: hasMultipleRoot,
        hasContentAfterRoot: true,
        hasDuplicateComprobanteClose: hasDuplicateClose,
        hasComplementAfterComprobanteClose: hasComplementAfter,
      };
    }
  }

  const complCloseMatches = cleanXml.match(/<cfdi:Complemento[^>]*>[\s\S]*<\/cfdi:Complemento>/gi);
  const retCloseMatches = cleanXml.match(/<retenciones:Retenciones[^>]*>[\s\S]*<\/retenciones:Retenciones>/gi);

  if ((complCloseMatches?.length ?? 0) > 1) {
    return {
      isWellFormed: false,
      errorCode: "XML_MULTIPLE_ROOT_ELEMENTS",
      message: "Se detectaron múltiples elementos Complemento raíz.",
      evidence: { complementCount: complCloseMatches?.length },
      hasMultipleRootElements: true,
    };
  }

  if ((retCloseMatches?.length ?? 0) > 1) {
    return {
      isWellFormed: false,
      errorCode: "XML_MULTIPLE_ROOT_ELEMENTS",
      message: "Se detectaron múltiples elementos Retenciones raíz.",
      evidence: { retencionesCount: retCloseMatches?.length },
      hasMultipleRootElements: true,
    };
  }

  const retencionesCloseMatch = cleanXml.match(/<retenciones:Retenciones[^>]*>[\s\S]*<\/retenciones:Retenciones>/i);
  const retencionesCloseIdx = retencionesCloseMatch
    ? cleanXml.indexOf(retencionesCloseMatch[0]) + retencionesCloseMatch[0].length
    : -1;

  if (retencionesCloseIdx > 0 && retencionesCloseIdx < cleanXml.length) {
    const afterRoot = cleanXml.slice(retencionesCloseIdx);
    const hasContent = afterRoot.replace(/^\s+$/gm, "").length > 0;

    if (hasContent) {
      return {
        isWellFormed: false,
        errorCode: "XML_MALFORMED_CONTENT_AFTER_ROOT",
        message:
          "El XML contiene contenido después del cierre de Retenciones, lo cual indica documento mal formado.",
        evidence: { contentAfterRootSnippet: afterRoot.replace(/^\s+$/gm, "").slice(0, 80) },
        hasMultipleRootElements: true,
        hasContentAfterRoot: true,
      };
    }
  }

  const compCloseIdx = cleanXml.match(/<\/cfdi:Comprobante>/i);
  if (compCloseIdx && compCloseIdx.index !== undefined) {
    const allCloseTags = Array.from(cleanXml.matchAll(/<\/cfdi:Comprobante>/gi));

    if (allCloseTags.length > 1) {
      return {
        isWellFormed: false,
        errorCode: "XML_DUPLICATE_COMPROBANTE_CLOSE",
        message: "El XML contiene múltiples cierres de cfdi:Comprobante, lo cual indica documento mal formado.",
        evidence: { duplicateCloseTagCount: allCloseTags.length },
        hasDuplicateComprobanteClose: true,
      };
    }
  }

  // Detectar XML truncado: tiene Comprobante pero no cierre
  const hasOpenComprobante = /<cfdi:Comprobante[^>]*>/i.test(cleanXml);
  const hasOpenRetenciones = /<retenciones:Retenciones[^>]*>/i.test(cleanXml);
  const hasCloseComprobante = /<\/cfdi:Comprobante>/i.test(cleanXml);
  const hasCloseRetenciones = /<\/retenciones:Retenciones>/i.test(cleanXml);

  if (hasOpenComprobante && !hasCloseComprobante) {
    return {
      isWellFormed: false,
      errorCode: "XML_TRUNCATED_NO_CLOSE",
      message: "El XML tiene cfdi:Comprobante abierto pero no tiene cierre. Posible archivo truncado.",
      evidence: { hasOpenTag: true, hasCloseTag: false },
      hasContentAfterRoot: false,
    };
  }

  if (hasOpenRetenciones && !hasCloseRetenciones) {
    return {
      isWellFormed: false,
      errorCode: "XML_TRUNCATED_NO_CLOSE",
      message: "El XML tiene retenciones:Retenciones abierto pero no tiene cierre. Posible archivo truncado.",
      evidence: { hasOpenTag: true, hasCloseTag: false },
      hasContentAfterRoot: false,
    };
  }

  // No detectar unclosed tags - deja eso para el parser
  return { isWellFormed: true };
}