import type { AnalysisResult, ZipFullAnalysisResult } from "../../api/xml-audit";
import { sortFindingsByPriority, getPriorityLabel } from "./findingPriority";
import {
  buildFindingGlossary,
  getSeverityLabel,
  getCategoryLabel,
  getFindingImpactLabel,
  getFindingRemediationHint,
} from "./findingGlossary.helpers";
import {
  aggregateMassivePerformance,
  aggregateMassiveTotals,
  aggregateMassivePriorities,
  aggregateMassiveActionGroups,
  getTopFindingCodes,
  aggregateMassiveDocumentKinds,
  aggregateMassiveModulesCoverage,
  getTopAffectedFiles,
} from "./massiveAggregates";

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function handleExportJsonIndividual(result: AnalysisResult) {
  const r = result;
  const payload = {
    generatedAt: new Date().toISOString(),
    uuid: r.uuid,
    tipoComprobante: r.tipoComprobante,
    rfcEmisor: r.rfcEmisor,
    nombreEmisor: r.nombreEmisor,
    rfcReceptor: r.rfcReceptor,
    nombreReceptor: r.nombreReceptor,
    fecha: r.fecha,
    total: r.total,
    subtotal: r.subtotal,
    moneda: r.moneda,
    version: r.version,
    serie: r.serie,
    folio: r.folio,
    usoCfdi: r.usoCfdi,
    metodoPago: r.metodoPago,
    formaPago: r.formaPago,
    fechaTimbrado: r.fechaTimbrado,
    totalImpuestosTrasladados: r.totalImpuestosTrasladados,
    totalImpuestosRetenidos: r.totalImpuestosRetenidos,
    issues: r.issues,
    warnings: r.warnings,
    executiveSummary: r.executiveSummary,
    findings: r.findings,
    technicalDiagnostics: r.technicalDiagnostics,
    structureDiagnostics: r.structureDiagnostics,
    paymentComplement: r.paymentComplement,
    concepts: r.concepts,
    taxSummary: r.taxSummary,
    totalsValidation: r.totalsValidation,
    normalizedXml: r.normalizedXml
      ? {
          available: r.normalizedXml.available,
          reason: r.normalizedXml.reason,
          filename: r.normalizedXml.filename,
          originalSha256: r.normalizedXml.originalSha256,
          normalizedSha256: r.normalizedXml.normalizedSha256,
          normalizationType: r.normalizedXml.normalizationType,
          fiscalContentModified: r.normalizedXml.fiscalContentModified,
          stampRisk: r.normalizedXml.stampRisk,
        }
      : undefined,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = r.uuid ?? ts;
  descargarBlob(blob, `fiscora-analisis-xml-${suffix}.json`);
}

export function handleExportCsvIndividual(result: AnalysisResult) {
  const r = result;
  if (!r.findings || r.findings.length === 0) return;
  const header =
    "ID,Severidad,Prioridad,Categoria,Grupo accionable,Codigo,Titulo,Mensaje,Accion recomendada,Evidencia";
  const rows = r.findings.map((f) => {
    const cols = [
      escCsv(f.id),
      escCsv(f.severity),
      escCsv(f.priority ?? "LOW"),
      escCsv(f.category),
      escCsv(f.actionGroup ?? "Informativo"),
      escCsv(f.code),
      escCsv(f.title),
      escCsv(f.message),
      escCsv(f.recommendedAction ?? ""),
      escCsv(formatEvidence(f.evidence)),
    ];
    return cols.join(",");
  });
  const bom = "\uFEFF";
  const csv = bom + header + "\r\n" + rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = r.uuid ?? ts;
  descargarBlob(blob, `fiscora-hallazgos-xml-${suffix}.csv`);
}

function escCsv(val: string): string {
  const v = val.replace(/"/g, '""');
  return /[",\n\r]/.test(v) ? `"${v}"` : v;
}

function escCsvMassive(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? "" : String(val);
  const v = s.replace(/"/g, '""');
  return /[",\n\r]/.test(v) ? `"${v}"` : v;
}

function formatEvidence(evidence: { label: string; value?: string }[] | undefined): string {
  if (!evidence || evidence.length === 0) return "";
  return evidence.map((e) => `${e.label}: ${e.value ?? "—"}`).join(" | ");
}

export function handleExportExcelIndividual(result: AnalysisResult) {
  const r = result;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = r.uuid ?? ts;
  const bom = "\uFEFF";
  const lines: string[] = [];

  function section(title: string) {
    lines.push("");
    lines.push(`"${title}"`);
    lines.push("");
  }
  function row(...vals: (string | null | undefined)[]) {
    lines.push(vals.map((v) => escCsv(v ?? "—")).join(","));
  }
  function sub(header: string, data: Record<string, string | null | undefined>) {
    lines.push(escCsv(header));
    for (const [k, v] of Object.entries(data)) {
      row(k, v ?? "—");
    }
    lines.push("");
  }

  section("RESUMEN EJECUTIVO");
  sub("", {
    "Nivel de riesgo": r.executiveSummary.riskLevel,
    Título: r.executiveSummary.title,
    Mensaje: r.executiveSummary.message,
    "Acción recomendada": r.executiveSummary.recommendedAction,
  });

  section("METADATA FISCAL");
  sub("", {
    UUID: r.uuid,
    "Tipo comprobante": r.tipoComprobante,
    "RFC emisor": r.rfcEmisor,
    "Nombre emisor": r.nombreEmisor,
    "RFC receptor": r.rfcReceptor,
    "Nombre receptor": r.nombreReceptor,
    Fecha: r.fecha,
    Serie: r.serie,
    Folio: r.folio,
    Subtotal: r.subtotal,
    Total: r.total,
    Moneda: r.moneda,
    "Versión CFDI": r.version,
    "Uso CFDI": r.usoCfdi,
    "Método pago": r.metodoPago,
    "Forma pago": r.formaPago,
    "Fecha timbrado": r.fechaTimbrado,
    "Total impuestos trasladados": r.totalImpuestosTrasladados,
    "Total impuestos retenidos": r.totalImpuestosRetenidos,
  });

  section("HALLAZGOS");
  if (r.findings && r.findings.length > 0) {
    row("ID", "Severidad", "Categoría", "Código", "Título", "Mensaje", "Acción recomendada");
    for (const f of r.findings) {
      row(f.id, f.severity, f.category, f.code, f.title, f.message, f.recommendedAction ?? "");
    }
    lines.push("");
    section("EVIDENCIA DE HALLAZGOS");
    row("ID hallazgo", "Label", "Valor");
    for (const f of r.findings) {
      if (f.evidence) {
        for (const e of f.evidence) {
          row(f.id, e.label, e.value ?? "—");
        }
      }
    }
  } else {
    row("No se detectaron hallazgos");
  }

  section("DIAGNÓSTICO TÉCNICO");
  sub("", {
    "XML timbrado": r.technicalDiagnostics.isStamped ? "Sí" : "No",
    "Timbre Fiscal Digital": r.technicalDiagnostics.hasTimbreFiscalDigital ? "Sí" : "No",
    "BOM UTF-8 detectado": r.technicalDiagnostics.bomDetected ? "Sí" : "No",
    "Contenido previo al XML": r.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No",
    "Normalización segura aplicada": r.technicalDiagnostics.safeNormalizationApplied ? "Sí" : "No",
  });
  if (r.technicalDiagnostics.safeNormalizationNotes.length > 0) {
    lines.push(escCsv("Notas de normalización"));
    for (const n of r.technicalDiagnostics.safeNormalizationNotes) {
      row(n);
    }
    lines.push("");
  }

  section("DIAGNÓSTICO ESTRUCTURAL");
  sub("", {
    "Tiene complemento": r.structureDiagnostics.hasComplemento ? "Sí" : "No",
    "Tiene addenda": r.structureDiagnostics.hasAddenda ? "Sí" : "No",
  });
  if (r.structureDiagnostics.namespaces.length > 0) {
    lines.push(escCsv("Namespaces"));
    for (const ns of r.structureDiagnostics.namespaces) row(ns);
    lines.push("");
  }
  if (r.structureDiagnostics.complementNames.length > 0) {
    lines.push(escCsv("Complementos detectados"));
    for (const c of r.structureDiagnostics.complementNames) row(c);
    lines.push("");
  }

  if (r.paymentComplement) {
    section("COMPLEMENTO DE PAGO");
    sub("", {
      Versión: r.paymentComplement.version ?? "—",
      "Total pagos": String(r.paymentComplement.pagos.length),
    });
    for (let i = 0; i < r.paymentComplement.pagos.length; i++) {
      const p = r.paymentComplement.pagos[i];
      lines.push("");
      lines.push(escCsv(`Pago ${i + 1}`));
      sub("", {
        "Fecha pago": p.fechaPago,
        "Forma pago": p.formaDePagoP,
        Moneda: p.monedaP,
        Monto: p.monto,
        "Tipo cambio": p.tipoCambioP,
        "Núm. operación": p.numOperacion,
      });
      if (p.documentosRelacionados.length > 0) {
        lines.push(escCsv("Documentos relacionados"));
        row(
          "UUID",
          "Serie",
          "Folio",
          "Moneda DR",
          "Equivalencia",
          "Parcialidad",
          "Saldo ant.",
          "Pagado",
          "Saldo insoluto",
          "Objeto imp.",
        );
        for (const d of p.documentosRelacionados) {
          row(
            d.idDocumento,
            d.serie,
            d.folio,
            d.monedaDR,
            d.equivalenciaDR,
            d.numParcialidad,
            d.impSaldoAnt,
            d.impPagado,
            d.impSaldoInsoluto,
            d.objetoImpDR,
          );
        }
      }
    }
  }

  if (r.cartaPorte) {
    section("CARTA PORTE - RESUMEN");
    sub("", {
      Versión: r.cartaPorte.version ?? "—",
      IdCCP: r.cartaPorte.idCCP ?? "—",
      "Transporte internacional": r.cartaPorte.transpInternac ?? "—",
      "Total distancia recorrida": r.cartaPorte.totalDistRec ?? "—",
      Autotransporte: r.cartaPorte.hasAutotransporte ? "Sí" : "No",
      Marítimo: r.cartaPorte.hasTransporteMaritimo ? "Sí" : "No",
      Aéreo: r.cartaPorte.hasTransporteAereo ? "Sí" : "No",
      Ferroviario: r.cartaPorte.hasTransporteFerroviario ? "Sí" : "No",
      "Total ubicaciones": String(r.cartaPorte.ubicaciones.length),
      "Total mercancías": String(r.cartaPorte.mercancias.length),
      "Total figuras transporte": String(r.cartaPorte.figurasTransporte.length),
    });
    if (r.cartaPorte.ubicaciones.length > 0) {
      section("CARTA PORTE - UBICACIONES");
      row(
        "#",
        "TipoUbicacion",
        "IDUbicacion",
        "RFCRemitenteDestinatario",
        "NombreRemitenteDestinatario",
        "FechaHoraSalidaLlegada",
        "DistanciaRecorrida",
      );
      for (let i = 0; i < r.cartaPorte.ubicaciones.length; i++) {
        const u = r.cartaPorte.ubicaciones[i];
        row(
          String(i + 1),
          u.tipoUbicacion,
          u.idUbicacion,
          u.rfcRemitenteDestinatario,
          u.nombreRemitenteDestinatario,
          u.fechaHoraSalidaLlegada,
          u.distanciaRecorrida,
        );
      }
      lines.push("");
    }
    if (r.cartaPorte.mercancias.length > 0) {
      section("CARTA PORTE - MERCANCÍAS");
      row(
        "#",
        "BienesTransp",
        "Descripcion",
        "Cantidad",
        "ClaveUnidad",
        "PesoEnKg",
        "ValorMercancia",
        "Moneda",
      );
      for (let i = 0; i < r.cartaPorte.mercancias.length; i++) {
        const m = r.cartaPorte.mercancias[i];
        row(
          String(i + 1),
          m.bienesTransp,
          m.descripcion,
          m.cantidad,
          m.claveUnidad,
          m.pesoEnKg,
          m.valorMercancia,
          m.moneda,
        );
      }
      lines.push("");
    }
    if (r.cartaPorte.figurasTransporte.length > 0) {
      section("CARTA PORTE - FIGURAS TRANSPORTE");
      row("#", "TipoFigura", "RFCFigura", "NombreFigura", "NumLicencia");
      for (let i = 0; i < r.cartaPorte.figurasTransporte.length; i++) {
        const f = r.cartaPorte.figurasTransporte[i];
        row(String(i + 1), f.tipoFigura, f.rfcFigura, f.nombreFigura, f.numLicencia);
      }
      lines.push("");
    }
  }

  if (r.comercioExterior) {
    section("COMERCIO EXTERIOR");
    sub("", {
      Versión: r.comercioExterior.version ?? "—",
      "Tipo operación": r.comercioExterior.tipoOperacion ?? "—",
      "Clave de pedimento": r.comercioExterior.claveDePedimento ?? "—",
      "Certificado de origen": r.comercioExterior.certificadoOrigen ?? "—",
      "No. exportador confiable": r.comercioExterior.numeroExportadorConfiable ?? "—",
      Incoterm: r.comercioExterior.incoterm ?? "—",
      SubDivisión: r.comercioExterior.subDivision ?? "—",
      TipoCambioUSD: r.comercioExterior.tipoCambioUSD ?? "—",
      TotalUSD: r.comercioExterior.totalUSD ?? "—",
      Observaciones: r.comercioExterior.observaciones ?? "—",
    });
  }

  if (r.impuestosLocales) {
    section("IMPUESTOS LOCALES - RESUMEN");
    sub("", {
      Versión: r.impuestosLocales.version ?? "—",
      "Total retenciones": r.impuestosLocales.totalDeRetenciones ?? "—",
      "Total traslados": r.impuestosLocales.totalDeTraslados ?? "—",
      Retenciones: String(r.impuestosLocales.retenciones.length),
      Traslados: String(r.impuestosLocales.traslados.length),
    });
    if (r.impuestosLocales.retenciones.length > 0) {
      section("IMPUESTOS LOCALES - RETENCIONES");
      row("#", "ImpLocRetenido", "TasaDeRetencion", "Importe");
      for (let i = 0; i < r.impuestosLocales.retenciones.length; i++) {
        const ret = r.impuestosLocales.retenciones[i];
        row(String(i + 1), ret.impLocRetenido, ret.tasaDeRetencion, ret.importe);
      }
      lines.push("");
    }
    if (r.impuestosLocales.traslados.length > 0) {
      section("IMPUESTOS LOCALES - TRASLADOS");
      row("#", "ImpLocTrasladado", "TasaDeTraslado", "Importe");
      for (let i = 0; i < r.impuestosLocales.traslados.length; i++) {
        const tras = r.impuestosLocales.traslados[i];
        row(String(i + 1), tras.impLocTrasladado, tras.tasaDeTraslado, tras.importe);
      }
      lines.push("");
    }
  }

  if (r.leyendasFiscales) {
    section("LEYENDAS FISCALES - RESUMEN");
    sub("", {
      Versión: r.leyendasFiscales.version ?? "—",
      "Total leyendas": String(r.leyendasFiscales.leyendas.length),
    });
    if (r.leyendasFiscales.leyendas.length > 0) {
      section("LEYENDAS FISCALES - DETALLE");
      row("#", "DisposicionFiscal", "Norma", "TextoLeyenda");
      for (let i = 0; i < r.leyendasFiscales.leyendas.length; i++) {
        const l = r.leyendasFiscales.leyendas[i];
        row(String(i + 1), l.disposicionFiscal ?? "—", l.norma ?? "—", l.textoLeyenda ?? "—");
      }
      lines.push("");
    }
  }

  if (r.donatarias) {
    section("DONATARIAS");
    sub("", {
      Versión: r.donatarias.version ?? "—",
      NoAutorizacion: r.donatarias.noAutorizacion ?? "—",
      FechaAutorizacion: r.donatarias.fechaAutorizacion ?? "—",
      Leyenda: r.donatarias.leyenda ?? "—",
    });
    lines.push("");
  }

  if (r.documentKind === "RETENCIONES" && r.retenciones) {
    section("RETENCIONES - GENERAL");
    sub("", {
      Versión: r.retenciones.version ?? "—",
      "Folio interno": r.retenciones.folioInt ?? "—",
      "Fecha expedición": r.retenciones.fechaExp ?? "—",
      CveRetenc: r.retenciones.cveRetenc ?? "—",
      DescRetenc: r.retenciones.descRetenc ?? "—",
      "Lugar expedición": r.retenciones.lugarExpRetenc ?? "—",
      UUID: r.retenciones.uuid ?? "—",
      "Fecha timbrado": r.retenciones.fechaTimbrado ?? "—",
    });
    if (r.retenciones.emisor) {
      section("RETENCIONES - EMISOR");
      sub("", {
        RFC: r.retenciones.emisor.rfcEmisor ?? "—",
        Nombre: r.retenciones.emisor.nombre ?? "—",
        CURP: r.retenciones.emisor.curp ?? "—",
      });
    }
    if (r.retenciones.receptor) {
      section("RETENCIONES - RECEPTOR");
      sub("", {
        Nacionalidad: r.retenciones.receptor.nacionalidad ?? "—",
        "RFC / NumRegIdTrib":
          r.retenciones.receptor.rfcReceptor ?? r.retenciones.receptor.numRegIdTrib ?? "—",
        Nombre: r.retenciones.receptor.nombre ?? "—",
        CURP: r.retenciones.receptor.curp ?? "—",
      });
    }
    if (r.retenciones.periodo) {
      section("RETENCIONES - PERIODO");
      sub("", {
        "Mes inicial": r.retenciones.periodo.mesIni ?? "—",
        "Mes final": r.retenciones.periodo.mesFin ?? "—",
        Ejercicio: r.retenciones.periodo.ejercicio ?? "—",
      });
    }
    if (r.retenciones.totales) {
      section("RETENCIONES - TOTALES");
      sub("", {
        "Monto total operación": r.retenciones.totales.montoTotOperacion ?? "—",
        "Monto total gravado": r.retenciones.totales.montoTotGrav ?? "—",
        "Monto total exento": r.retenciones.totales.montoTotExent ?? "—",
        "Monto total retenido": r.retenciones.totales.montoTotRet ?? "—",
      });
      if (r.retenciones.totales.impuestosRetenidos.length > 0) {
        section("RETENCIONES - IMPUESTOS RETENIDOS");
        row("#", "BaseRet", "Impuesto", "MontoRet", "TipoPagoRet");
        for (let i = 0; i < r.retenciones.totales.impuestosRetenidos.length; i++) {
          const ir = r.retenciones.totales.impuestosRetenidos[i];
          row(
            String(i + 1),
            ir.baseRet ?? "—",
            ir.impuesto ?? "—",
            ir.montoRet ?? "—",
            ir.tipoPagoRet ?? "—",
          );
        }
        lines.push("");
      }
    }
  }

  if (r.addenda?.detected) {
    section("ADDENDA - RESUMEN");
    sub("", {
      Detectada: "Sí",
      "Root keys": r.addenda.rootKeys.join(", "),
      "Node count": String(r.addenda.nodeCount),
      "Max depth": String(r.addenda.maxDepth),
      Truncada: r.addenda.truncated ? "Sí" : "No",
      "Señales detectadas": String(r.addenda.signals.length),
    });
    if (r.addenda.signals.length > 0) {
      section("ADDENDA - SEÑALES");
      row("#", "Label", "Valor", "Path", "Confianza");
      for (let i = 0; i < r.addenda.signals.length; i++) {
        const s = r.addenda.signals[i];
        row(String(i + 1), s.label, s.value, s.path, s.confidence);
      }
      lines.push("");
    }
    if (r.addenda.nodeSummary.length > 0) {
      section("ADDENDA - NODOS");
      row("#", "Path", "Nombre", "Child count", "Scalar fields");
      for (let i = 0; i < r.addenda.nodeSummary.length; i++) {
        const ns = r.addenda.nodeSummary[i];
        row(String(i + 1), ns.path, ns.name, String(ns.childCount), String(ns.scalarFields));
      }
      lines.push("");
    }
  }

  if (r.concepts && r.concepts.length > 0) {
    section("CONCEPTOS");
    row(
      "ClaveProdServ",
      "No. identificación",
      "Cantidad",
      "Clave unidad",
      "Unidad",
      "Descripción",
      "Valor unitario",
      "Importe",
      "Descuento",
      "Objeto imp.",
    );
    for (const c of r.concepts) {
      row(
        c.claveProdServ,
        c.noIdentificacion,
        c.cantidad,
        c.claveUnidad,
        c.unidad,
        c.descripcion,
        c.valorUnitario,
        c.importe,
        c.descuento,
        c.objetoImp,
      );
    }
    lines.push("");
    section("IMPUESTOS POR CONCEPTO");
    row("Concepto #", "Tipo", "Base", "Impuesto", "Tipo factor", "Tasa o cuota", "Importe");
    for (let i = 0; i < r.concepts.length; i++) {
      const c = r.concepts[i];
      const label = `Concepto #${i + 1}`;
      if (c.impuestos) {
        for (const t of c.impuestos.traslados)
          row(label, "Traslado", t.base, t.impuesto, t.tipoFactor, t.tasaOCuota, t.importe);
        for (const t of c.impuestos.retenciones)
          row(label, "Retención", t.base, t.impuesto, t.tipoFactor, t.tasaOCuota, t.importe);
      }
    }
  }

  if (r.taxSummary) {
    section("RESUMEN DE IMPUESTOS");
    if (r.taxSummary.transferred.length > 0) {
      lines.push(escCsv("Trasladados"));
      row("Impuesto", "Tipo factor", "Tasa o cuota", "Base calculada", "Importe calculado");
      for (const t of r.taxSummary.transferred)
        row(t.impuestoLabel, t.tipoFactor, t.tasaOCuota, t.baseCalculated, t.importeCalculated);
      lines.push("");
    }
    if (r.taxSummary.retained.length > 0) {
      lines.push(escCsv("Retenidos"));
      row("Impuesto", "Tipo factor", "Tasa o cuota", "Base calculada", "Importe calculado");
      for (const t of r.taxSummary.retained)
        row(t.impuestoLabel, t.tipoFactor, t.tasaOCuota, t.baseCalculated, t.importeCalculated);
      lines.push("");
    }
  }

  if (r.totalsValidation) {
    section("VALIDACIÓN DE TOTALES");
    sub("", {
      "Subtotal XML": r.totalsValidation.subtotalXml,
      "Subtotal calculado": r.totalsValidation.subtotalCalculated,
      "Descuento calculado": r.totalsValidation.discountCalculated,
      "Impuestos trasladados XML": r.totalsValidation.transferredTaxesXml,
      "Impuestos trasladados calculados": r.totalsValidation.transferredTaxesCalculated,
      "Impuestos retenidos XML": r.totalsValidation.retainedTaxesXml,
      "Impuestos retenidos calculados": r.totalsValidation.retainedTaxesCalculated,
      "Total XML": r.totalsValidation.totalXml,
      "Total calculado": r.totalsValidation.totalCalculated,
      Diferencia: r.totalsValidation.difference,
      Tolerancia: r.totalsValidation.tolerance,
      Coinciden: r.totalsValidation.matches ? "Sí" : "No",
    });
  }

  if (r.normalizedXml) {
    section("NORMALIZACIÓN TÉCNICA");
    sub("", {
      Disponible: r.normalizedXml.available ? "Sí" : "No",
      Archivo: r.normalizedXml.filename,
      "Tipo normalización": r.normalizedXml.normalizationType,
      "Contenido fiscal modificado": r.normalizedXml.fiscalContentModified ? "Sí" : "No",
      "Riesgo timbre/sello": r.normalizedXml.stampRisk,
      "Hash original SHA-256": r.normalizedXml.originalSha256,
      "Hash normalizado SHA-256": r.normalizedXml.normalizedSha256,
    });
  }

  if (r.analysisMeta) {
    const p = r.analysisMeta.performance;
    section("METADATA DEL ANALISIS");
    sub("Rendimiento", {
      "Tiempo total (ms)": String(p.totalMs),
      "Tamaño entrada (bytes)": String(p.inputBytes),
      "Tamaño entrada (KB)": String(p.inputKb),
      "Hallazgos originales": String(p.findingsOriginalCount),
      "Hallazgos devueltos": String(p.findingsReturnedCount),
      Truncado: p.findingsTruncated ? "Sí" : "No",
      Sanitizado: p.sanitized ? "Sí" : "No",
      "XML normalizado disponible": p.normalizedXmlAvailable ? "Sí" : "No",
    });
    sub("Documento", {
      "Engine version": r.analysisMeta.engineVersion,
      "Tipo documento": r.analysisMeta.coverage.documentKind,
      "Complementos detectados": r.analysisMeta.coverage.complementsDetected.join(", "),
      "Complementos no clasificados": r.analysisMeta.coverage.complementsUnknown.join(", "),
      Addenda: r.analysisMeta.coverage.hasAddenda ? "Sí" : "No",
      "Timbre Fiscal Digital": r.analysisMeta.coverage.hasTimbreFiscalDigital ? "Sí" : "No",
      "Normalización segura": r.analysisMeta.coverage.hasSafeNormalization ? "Sí" : "No",
    });
    section("COBERTURA DEL ANALISIS");
    row("Módulo", "Detectado", "Analizado", "Hallazgos", "Motivo omisión");
    for (const m of r.analysisMeta.coverage.modules) {
      row(
        m.label,
        m.detected ? "Sí" : "No",
        m.analyzed ? "Sí" : "No",
        String(m.findingsCount),
        m.skippedReason ?? "",
      );
    }
    lines.push("");
  }

  if (r.findings && r.findings.length > 0) {
    section("PRIORIDADES DE HALLAZGOS");
    row(
      "Prioridad",
      "Grupo accionable",
      "Código",
      "Severidad",
      "Categoría",
      "Título",
      "Acción recomendada",
    );
    const sorted = sortFindingsByPriority(r.findings);
    for (const f of sorted) {
      row(
        f.priority ?? "LOW",
        f.actionGroup ?? "Informativo",
        f.code,
        f.severity,
        f.category,
        f.title,
        f.recommendedAction ?? "",
      );
    }
    lines.push("");

    section("GLOSARIO DE HALLAZGOS");
    row(
      "Código",
      "Título",
      "Severidad",
      "Prioridad",
      "Categoría",
      "Grupo accionable",
      "Ocurrencias",
      "Mensaje",
      "Impacto",
      "Acción recomendada",
      "Guía general",
    );
    const glossary = buildFindingGlossary(r.findings);
    for (const e of glossary) {
      row(
        e.code,
        e.title,
        getSeverityLabel(e.severity),
        getPriorityLabel(e.priority),
        getCategoryLabel(e.category),
        e.actionGroup,
        String(e.occurrences),
        e.message,
        getFindingImpactLabel(e.severity),
        e.recommendedAction,
        getFindingRemediationHint(e.actionGroup),
      );
    }
  }

  const csv = bom + "\r\n" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
  descargarBlob(blob, `fiscora-analisis-xml-${suffix}.csv`);
}

export function handleExportMassiveCsv(result: ZipFullAnalysisResult) {
  const r = result;
  const bom = "\uFEFF";
  const lines: string[] = [];

  function section(title: string) {
    lines.push("");
    lines.push(`"${title}"`);
    lines.push("");
  }
  function row(...vals: (string | number | null | undefined)[]) {
    lines.push(vals.map((v) => escCsvMassive(v ?? "—")).join(","));
  }

  section("RESUMEN MASIVO");
  row("Archivo ZIP", r.filename);
  row("Total entradas", r.totalEntries);
  row("XML encontrados", r.xmlFilesFound);
  row("XML analizados", r.analyzedCount);
  row("XML fallidos", r.failedCount);
  row("Entradas ignoradas", r.ignoredEntries);
  row("Críticos", r.summary.criticalCount);
  row("Advertencias", r.summary.warningCount);
  row("OK", r.summary.okCount);
  row("Solo informativos", r.summary.infoOnlyCount);
  row("XMLs con BOM", r.summary.filesWithBom);
  row("XMLs con normalización técnica", r.summary.filesWithTechnicalNormalization);
  const tiposStr = Object.entries(r.summary.byTipoComprobante)
    .map(([t, c]) => `${t}: ${c}`)
    .join(" | ");
  row("Tipos de comprobante", tiposStr || "—");
  const warningsGlobales = r.warnings.length > 0 ? r.warnings.join(" | ") : "—";
  row("Warnings globales", warningsGlobales);

  section("RESULTADOS POR XML");
  const resultHeader = [
    "#",
    "Archivo",
    "Tamaño bytes",
    "Estado",
    "Código error",
    "Mensaje error",
    "UUID",
    "Tipo comprobante",
    "RFC emisor",
    "Nombre emisor",
    "RFC receptor",
    "Nombre receptor",
    "Fecha CFDI",
    "Subtotal",
    "Total",
    "Moneda",
    "Versión",
    "Serie",
    "Folio",
    "Riesgo",
    "Título resumen ejecutivo",
    "Mensaje resumen ejecutivo",
    "Acción recomendada",
    "Total hallazgos",
    "Críticos",
    "Advertencias",
    "Informativos",
    "BOM",
    "Timbre Fiscal Digital",
    "XML timbrado",
    "Normalización segura aplicada",
    "XML normalizado disponible",
    "Archivo normalizado",
    "Tipo normalización",
    "Contenido fiscal modificado",
    "Riesgo timbre/sello",
    "Hash original SHA-256",
    "Hash normalizado SHA-256",
  ];
  row(...resultHeader);

  for (let i = 0; i < r.results.length; i++) {
    const f = r.results[i];
    const isA = f.status === "ANALYZED";
    const a = f.analysis;
    const es = a?.executiveSummary;
    const td = a?.technicalDiagnostics;
    const nx = a?.normalizedXml;
    const findings = a?.findings ?? [];
    row(
      i + 1,
      f.name,
      f.sizeBytes,
      f.status,
      f.errorCode ?? "",
      f.errorMessage ?? "",
      isA ? (a?.uuid ?? "") : "",
      isA ? (a?.tipoComprobante ?? "") : "",
      isA ? (a?.rfcEmisor ?? "") : "",
      isA ? (a?.nombreEmisor ?? "") : "",
      isA ? (a?.rfcReceptor ?? "") : "",
      isA ? (a?.nombreReceptor ?? "") : "",
      isA ? (a?.fecha ?? "") : "",
      isA ? (a?.subtotal ?? "") : "",
      isA ? (a?.total ?? "") : "",
      isA ? (a?.moneda ?? "") : "",
      isA ? (a?.version ?? "") : "",
      isA ? (a?.serie ?? "") : "",
      isA ? (a?.folio ?? "") : "",
      isA ? (es?.riskLevel ?? "") : "",
      isA ? (es?.title ?? "") : "",
      isA ? (es?.message ?? "") : "",
      isA ? (es?.recommendedAction ?? "") : "",
      isA ? findings.length : 0,
      isA ? findings.filter((f) => f.severity === "CRITICAL").length : 0,
      isA ? findings.filter((f) => f.severity === "WARNING").length : 0,
      isA ? findings.filter((f) => f.severity === "INFO").length : 0,
      isA ? (td?.bomDetected ? "Sí" : "No") : "",
      isA ? (td?.hasTimbreFiscalDigital ? "Sí" : "No") : "",
      isA ? (td?.isStamped ? "Sí" : "No") : "",
      isA ? (td?.safeNormalizationApplied ? "Sí" : "No") : "",
      isA ? (nx?.available ? "Sí" : "No") : "",
      isA ? (nx?.filename ?? "") : "",
      isA ? (nx?.normalizationType ?? "") : "",
      isA ? (nx?.fiscalContentModified ? "Sí" : "No") : "",
      isA ? (nx?.stampRisk ?? "") : "",
      isA ? (nx?.originalSha256 ?? "") : "",
      isA ? (nx?.normalizedSha256 ?? "") : "",
    );
  }

  section("HALLAZGOS POR XML");
  row(
    "Archivo",
    "Finding ID",
    "Severidad",
    "Categoría",
    "Código",
    "Título",
    "Mensaje",
    "Acción recomendada",
    "Evidencia",
  );
  for (const f of r.results) {
    if (f.status !== "ANALYZED" || !f.analysis?.findings) continue;
    for (const finding of f.analysis.findings) {
      const evidenceStr = finding.evidence
        ? finding.evidence.map((e) => `${e.label}: ${e.value ?? "—"}`).join(" | ")
        : "";
      row(
        f.name,
        finding.id,
        finding.severity,
        finding.category,
        finding.code,
        finding.title,
        finding.message,
        finding.recommendedAction ?? "",
        evidenceStr,
      );
    }
  }

  const perfAgg = aggregateMassivePerformance(r.results);
  const totals = aggregateMassiveTotals(r.results);
  const priorities = aggregateMassivePriorities(r.results);
  const actionGroups = aggregateMassiveActionGroups(r.results);
  const topFindings = getTopFindingCodes(r.results, 10);
  const docKinds = aggregateMassiveDocumentKinds(r.results);
  const modulesCov = aggregateMassiveModulesCoverage(r.results);
  const affectedFiles = getTopAffectedFiles(r.results, 10);

  section("RESUMEN EJECUTIVO ZIP");
  row("Indicador", "Valor");
  row("XML analizados", totals.analyzed);
  row("Fallidos", totals.failed);
  row("Con críticos", totals.withCritical);
  row("Con advertencias", totals.withWarning);
  row("OK", totals.ok);
  row("Con BOM", totals.withBom);
  row("Con normalización técnica", totals.withTechNorm);
  row("Con XML normalizado disponible", totals.withNormXml);
  row("CFDI", docKinds.CFDI);
  row("RETENCIONES", docKinds.RETENCIONES);
  row("UNKNOWN", docKinds.UNKNOWN);
  if (perfAgg) {
    row("Tiempo total (ms)", perfAgg.totalMs);
    row("Tiempo promedio (ms)", perfAgg.avgMs);
    row("Tamaño total (KB)", perfAgg.totalKb);
    row("Tamaño promedio (KB)", perfAgg.avgKb);
    row("Hallazgos originales totales", perfAgg.totalFindingsOriginal);
    row("Hallazgos devueltos totales", perfAgg.totalFindingsReturned);
    row("Archivos con truncamiento", perfAgg.filesTruncated);
  }

  section("PRIORIDADES ZIP");
  row("Prioridad", "Hallazgos", "Archivos afectados");
  if (priorities.BLOCKER > 0) row("BLOCKER", priorities.BLOCKER, priorities.filesWithBlocker);
  if (priorities.HIGH > 0) row("HIGH", priorities.HIGH, priorities.filesWithHigh);
  if (priorities.MEDIUM > 0) row("MEDIUM", priorities.MEDIUM, "—");
  if (priorities.LOW > 0) row("LOW", priorities.LOW, "—");

  section("GRUPOS ACCIONABLES ZIP");
  row("Grupo", "Hallazgos", "Archivos afectados", "Críticos", "Advertencias", "Info");
  for (const g of actionGroups) {
    row(
      g.group,
      g.totalFindings,
      g.affectedFiles.length,
      g.criticalCount,
      g.warningCount,
      g.infoCount,
    );
  }

  if (topFindings.length > 0) {
    section("TOP HALLAZGOS ZIP");
    row(
      "Código",
      "Título",
      "Severidad máxima",
      "Prioridad máxima",
      "Apariciones",
      "Archivos afectados",
      "Acción recomendada",
    );
    for (const f of topFindings) {
      row(
        f.code,
        f.title,
        f.maxSeverity,
        f.maxPriority,
        f.totalAppearances,
        f.affectedFiles.length,
        f.recommendedAction,
      );
    }
  }

  if (modulesCov.length > 0) {
    section("COBERTURA MODULOS ZIP");
    row(
      "Módulo",
      "Detectado en",
      "Analizado en",
      "Hallazgos totales",
      "Archivos con hallazgos",
      "Motivo omisión principal",
    );
    for (const m of modulesCov) {
      row(
        m.moduleLabel,
        m.detectedIn,
        m.analyzedIn,
        m.totalFindings,
        m.filesWithFindings,
        m.skippedReasons[0] ?? "",
      );
    }
  }

  if (perfAgg) {
    section("PERFORMANCE ZIP");
    row("Indicador", "Valor");
    row("Tiempo total (ms)", perfAgg.totalMs);
    row("Promedio (ms)", perfAgg.avgMs);
    row("Máximo (ms)", `${perfAgg.maxMs} (${perfAgg.maxMsFile})`);
    row("Mínimo (ms)", `${perfAgg.minMs} (${perfAgg.minMsFile})`);
    row("Tamaño total (KB)", perfAgg.totalKb);
    row("Tamaño promedio (KB)", perfAgg.avgKb);
    row("Hallazgos originales totales", perfAgg.totalFindingsOriginal);
    row("Hallazgos devueltos totales", perfAgg.totalFindingsReturned);
    row("Archivos con truncamiento", perfAgg.filesTruncated);
  }

  if (affectedFiles.length > 0) {
    section("ARCHIVOS MAS AFECTADOS");
    row("Archivo", "Hallazgos", "Críticos", "Advertencias", "Prioridad máxima", "Acción principal");
    for (const af of affectedFiles) {
      row(
        af.file.name,
        af.totalFindings,
        af.criticals,
        af.warnings,
        af.maxPriority,
        af.topActionGroup,
      );
    }
  }

  const csv = bom + "\r\n" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const zipBase = r.filename
    ? r.filename.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_")
    : "masivo";
  descargarBlob(blob, `fiscora-analisis-masivo-xml-${zipBase}-${ts}.csv`);
}
