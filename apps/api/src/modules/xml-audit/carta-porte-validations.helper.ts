import type {
  CartaPorteInfo,
  CartaPorteUbicacion,
  CartaPorteMercancia,
  CartaPorteTransportFigure,
} from "./xml-audit.service.js";

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function toNum(val: string | null | undefined): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val.replace(/[T ]/, "T").trim());
  return isNaN(d.getTime()) ? null : d;
}

type Severity = "CRITICAL" | "WARNING" | "INFO";

type FindingAdder = (
  code: string,
  severity: Severity,
  title: string,
  message: string,
  recommendedAction: string,
  evidence: { label: string; value?: string }[],
) => void;

export interface CartaPorteAdvancedContext {
  cartaPorte: CartaPorteInfo | null;
  addFinding: FindingAdder;
}

const DEFAULT_VERSIONS = ["2.0", "3.0", "3.1"];

function normalizeCpVersion(version: string | null | undefined): string | null {
  if (!version) return null;
  const v = version.trim();
  if (DEFAULT_VERSIONS.includes(v)) return v;
  const m = v.match(/^(\d+\.\d+)/);
  return m ? m[1] : v;
}

export function validateCartaPorteAdvanced(ctx: CartaPorteAdvancedContext): void {
  const { cartaPorte, addFinding } = ctx;
  if (!cartaPorte) return;

  const cpVersion = normalizeCpVersion(cartaPorte.version);

  const cpEvidence = (extra?: { label: string; value?: string }[]): { label: string; value?: string }[] => [
    { label: "version", value: cartaPorte.version ?? "—" },
    { label: "transpInternac", value: cartaPorte.transpInternac ?? "—" },
    { label: "totalDistRec", value: cartaPorte.totalDistRec ?? "—" },
    ...(extra ?? []),
  ];

  // ── A) Reglas de atributos generales ──

  // A2) TotalDistRec missing review (version >= 3.0, TranspInternac = No)
  if (
    cpVersion &&
    ["3.0", "3.1"].includes(cpVersion) &&
    cartaPorte.transpInternac?.toLowerCase() === "no" &&
    !isNonEmptyString(cartaPorte.totalDistRec)
  ) {
    addFinding(
      "CARTA_PORTE_TOTAL_DIST_REC_MISSING_REVIEW",
      "INFO",
      "TotalDistRec no especificado",
      "El complemento Carta Porte no especifica TotalDistRec siendo transporte nacional.",
      "Si aplica, captura la distancia total recorrida en el complemento.",
      cpEvidence(),
    );
  }

  // A3) TotalDistRec non-positive
  const totalDistNum = toNum(cartaPorte.totalDistRec);
  if (totalDistNum !== null && totalDistNum <= 0) {
    addFinding(
      "CARTA_PORTE_TOTAL_DIST_REC_NON_POSITIVE",
      "WARNING",
      "TotalDistRec debe ser positivo",
      "TotalDistRec está presente pero no es un valor positivo.",
      "Revisa que la distancia total recorrida sea un número mayor a cero.",
      cpEvidence([{ label: "totalDistRec", value: cartaPorte.totalDistRec ?? "—" }]),
    );
  }

  // A4) TranspInternac missing
  if (!isNonEmptyString(cartaPorte.transpInternac)) {
    addFinding(
      "CARTA_PORTE_TRANSP_INTERNAC_MISSING",
      "WARNING",
      "TranspInternac no especificado",
      "El complemento Carta Porte no especifica si el transporte es internacional o nacional.",
      "Captura el valor del atributo TranspInternac (Sí/No) en el complemento.",
      cpEvidence(),
    );
  }

  // A5) Internacional missing PaisOrigenDestino / ViaEntradaSalida
  if (
    isNonEmptyString(cartaPorte.transpInternac) &&
    cartaPorte.transpInternac!.toLowerCase() === "sí"
  ) {
    if (!isNonEmptyString(cartaPorte.paisOrigenDestino) || !isNonEmptyString(cartaPorte.viaEntradaSalida)) {
      addFinding(
        "CARTA_PORTE_INTERNACIONAL_MISSING_PAIS_OR_VIA",
        "WARNING",
        "Transporte internacional sin país o vía de entrada/salida",
        "TranspInternac es Sí pero faltan PaisOrigenDestino o ViaEntradaSalida.",
        "Completa la información de país de origen/destino y vía de entrada/salida.",
        cpEvidence([
          { label: "paisOrigenDestino", value: cartaPorte.paisOrigenDestino ?? "—" },
          { label: "viaEntradaSalida", value: cartaPorte.viaEntradaSalida ?? "—" },
        ]),
      );
    }
  }

  // A6) Nacional with paisOrigenDestino or viaEntradaSalida
  if (
    isNonEmptyString(cartaPorte.transpInternac) &&
    cartaPorte.transpInternac!.toLowerCase() === "no" &&
    (isNonEmptyString(cartaPorte.paisOrigenDestino) || isNonEmptyString(cartaPorte.viaEntradaSalida))
  ) {
    addFinding(
      "CARTA_PORTE_NACIONAL_WITH_PAIS_OR_VIA_REVIEW",
      "INFO",
      "Transporte nacional con país o vía de entrada/salida",
      "TranspInternac es No pero se detectaron PaisOrigenDestino o ViaEntradaSalida.",
      "Revisa si el transporte debe ser internacional o si estos campos son correctos.",
      cpEvidence([
        { label: "paisOrigenDestino", value: cartaPorte.paisOrigenDestino ?? "—" },
        { label: "viaEntradaSalida", value: cartaPorte.viaEntradaSalida ?? "—" },
      ]),
    );
  }

  // ── B) Reglas de ubicaciones (skip B1/B5: existentes) ──
  if (cartaPorte.ubicaciones.length === 0) return;

  // B4) Single location review
  if (cartaPorte.ubicaciones.length === 1) {
    addFinding(
      "CARTA_PORTE_SINGLE_LOCATION_REVIEW",
      "INFO",
      "Solo una ubicación en Carta Porte",
      "El complemento contiene una sola ubicación; puede ser insuficiente para cubrir origen y destino.",
      "Revisa que el complemento incluya al menos ubicaciones de origen y destino.",
      cpEvidence([
        { label: "totalUbicaciones", value: "1" },
        { label: "tipoUnico", value: cartaPorte.ubicaciones[0]?.tipoUbicacion ?? "—" },
      ]),
    );
  }

  // B6-B13 per ubicacion (skip B5: UBICACION_MISSING_RFC exists)
  cartaPorte.ubicaciones.forEach((ubi, uIdx) => {
    const ubiNum = uIdx + 1;
    const extraEvidence = (): { label: string; value?: string }[] => [
      { label: "ubicacionIndex", value: String(ubiNum) },
      { label: "tipoUbicacion", value: ubi.tipoUbicacion ?? "—" },
    ];

    // B6) FechaHora missing
    if (!isNonEmptyString(ubi.fechaHoraSalidaLlegada)) {
      addFinding(
        "CARTA_PORTE_UBICACION_MISSING_FECHA_HORA",
        "WARNING",
        "Ubicación sin fecha/hora",
        "Una ubicación de Carta Porte no contiene FechaHoraSalidaLlegada.",
        "Captura la fecha y hora correspondiente a la ubicación.",
        cpEvidence(extraEvidence()),
      );
    }

    // B7) FechaHora invalid format
    if (isNonEmptyString(ubi.fechaHoraSalidaLlegada)) {
      const parsed = parseDate(ubi.fechaHoraSalidaLlegada);
      if (!parsed) {
        addFinding(
          "CARTA_PORTE_UBICACION_FECHA_INVALID",
          "WARNING",
          "Fecha/hora de ubicación inválida",
          "Una ubicación contiene FechaHoraSalidaLlegada con formato no válido.",
          "Revisa que el formato de fecha/hora sea correcto.",
          cpEvidence([
            ...extraEvidence(),
            { label: "fechaHora", value: ubi.fechaHoraSalidaLlegada ?? "—" },
          ]),
        );
      }
    }

    // B8) Destino without DistanciaRecorrida
    if (ubi.tipoUbicacion?.toLowerCase() === "destino" && !isNonEmptyString(ubi.distanciaRecorrida)) {
      addFinding(
        "CARTA_PORTE_DESTINO_WITHOUT_DISTANCIA",
        "WARNING",
        "Ubicación destino sin distancia recorrida",
        "La ubicación de tipo Destino no especifica DistanciaRecorrida.",
        "Captura la distancia recorrida hasta el destino.",
        cpEvidence(extraEvidence()),
      );
    }

    // B9) Distancia non-positive (complement to existing INVALID_DISTANCE)
    const distNum = toNum(ubi.distanciaRecorrida);
    if (distNum !== null && distNum <= 0) {
      addFinding(
        "CARTA_PORTE_DISTANCIA_NON_POSITIVE",
        "WARNING",
        "Distancia recorrida no positiva",
        "La distancia recorrida de una ubicación no es un valor positivo.",
        "Revisa que la distancia sea mayor a cero.",
        cpEvidence([
          ...extraEvidence(),
          { label: "distanciaRecorrida", value: ubi.distanciaRecorrida ?? "—" },
        ]),
      );
    }
  });

  // B10) TotalDistRec mismatch vs sum of destino distances
  if (isNonEmptyString(cartaPorte.totalDistRec) && cartaPorte.ubicaciones.length > 0) {
    const totalDist = toNum(cartaPorte.totalDistRec);
    const sumDestinoDist = cartaPorte.ubicaciones
      .filter((u) => u.tipoUbicacion?.toLowerCase() === "destino")
      .reduce((sum, u) => {
        const d = toNum(u.distanciaRecorrida);
        return sum + (d !== null ? d : 0);
      }, 0);
    if (totalDist !== null && sumDestinoDist > 0 && Math.abs(totalDist - sumDestinoDist) > 0.01) {
      addFinding(
        "CARTA_PORTE_TOTAL_DIST_REC_MISMATCH",
        "WARNING",
        "TotalDistRec no coincide con suma de distancias de destino",
        "La distancia total declarada difiere de la suma de distancias de las ubicaciones destino.",
        "Revisa que TotalDistRec sea consistente con las distancias de las ubicaciones destino.",
        cpEvidence([
          { label: "totalDistRec", value: cartaPorte.totalDistRec },
          { label: "sumaDestinoDist", value: String(sumDestinoDist) },
        ]),
      );
    }
  }

  // ── C) Reglas de mercancías (skip C1/C5-C8: existentes) ──

  // C2) numTotalMercancias missing
  if (cartaPorte.mercancias.length > 0 && !isNonEmptyString(cartaPorte.numTotalMercancias)) {
    addFinding(
      "CARTA_PORTE_MERCANCIAS_TOTAL_MISSING",
      "WARNING",
      "NumTotalMercancias no especificado",
      "El complemento tiene mercancías pero no especifica NumTotalMercancias.",
      "Captura el número total de mercancías en el nodo Mercancias.",
      cpEvidence(),
    );
  }

  // C3) numTotalMercancias mismatch
  const numTotalMerc = toNum(cartaPorte.numTotalMercancias);
  if (numTotalMerc !== null && numTotalMerc !== cartaPorte.mercancias.length) {
    addFinding(
      "CARTA_PORTE_NUM_TOTAL_MERCANCIAS_MISMATCH",
      "WARNING",
      "NumTotalMercancias no coincide con el número de mercancías",
      "La cantidad declarada en NumTotalMercancias difiere del número real de nodos Mercancia.",
      "Revisa que NumTotalMercancias refleje la cantidad correcta de mercancías.",
      cpEvidence([
        { label: "numTotalMercancias", value: cartaPorte.numTotalMercancias ?? "—" },
        { label: "mercanciasCount", value: String(cartaPorte.mercancias.length) },
      ]),
    );
  }

  // C4) PesoBrutoTotal mismatch vs sum of PesoEnKg
  const pesoBruto = toNum(cartaPorte.pesoBrutoTotal);
  if (pesoBruto !== null && cartaPorte.mercancias.length > 0) {
    const sumPeso = cartaPorte.mercancias.reduce((sum, m) => {
      const p = toNum(m.pesoEnKg);
      return sum + (p !== null ? p : 0);
    }, 0);
    if (sumPeso > 0 && Math.abs(pesoBruto - sumPeso) > 0.01) {
      addFinding(
        "CARTA_PORTE_PESO_BRUTO_TOTAL_MISMATCH",
        "WARNING",
        "PesoBrutoTotal no coincide con suma de PesoEnKg",
        "El peso bruto total declarado difiere de la suma de los pesos de las mercancías.",
        "Revisa que PesoBrutoTotal sea consistente con la suma de PesoEnKg de las mercancías.",
        cpEvidence([
          { label: "pesoBrutoTotal", value: cartaPorte.pesoBrutoTotal ?? "—" },
          { label: "sumaPesoEnKg", value: String(sumPeso) },
        ]),
      );
    }
  }

  // C9-C11 per mercancia (skip C5-C8: existentes)
  cartaPorte.mercancias.forEach((mer, mIdx) => {
    const merNum = mIdx + 1;
    const merEvidence = (): { label: string; value?: string }[] => [
      { label: "mercanciaIndex", value: String(merNum) },
      { label: "bienesTransp", value: mer.bienesTransp ?? "—" },
    ];

    // C9) Missing ClaveUnidad
    if (!isNonEmptyString(mer.claveUnidad)) {
      addFinding(
        "CARTA_PORTE_MERCANCIA_MISSING_CLAVE_UNIDAD",
        "WARNING",
        "Mercancía sin ClaveUnidad",
        "Una mercancía no contiene ClaveUnidad.",
        "Revisa la clave de unidad de medida de la mercancía.",
        cpEvidence(merEvidence()),
      );
    }

    // C10) MaterialPeligroso without CveMaterialPeligroso
    if (
      isNonEmptyString(mer.materialPeligroso) &&
      mer.materialPeligroso!.toLowerCase() === "sí" &&
      !isNonEmptyString(mer.cveMaterialPeligroso)
    ) {
      addFinding(
        "CARTA_PORTE_MATERIAL_PELIGROSO_WITHOUT_CLAVE",
        "WARNING",
        "Material peligroso sin clave de material",
        "Se indica MaterialPeligroso = Sí pero no se especifica CveMaterialPeligroso.",
        "Captura la clave del material peligroso según la normativa aplicable.",
        cpEvidence(merEvidence()),
      );
    }

    // C11) MaterialPeligroso without Embalaje
    if (
      isNonEmptyString(mer.materialPeligroso) &&
      mer.materialPeligroso!.toLowerCase() === "sí" &&
      !isNonEmptyString(mer.embalaje)
    ) {
      addFinding(
        "CARTA_PORTE_MATERIAL_PELIGROSO_WITHOUT_EMBALAJE",
        "WARNING",
        "Material peligroso sin tipo de embalaje",
        "Se indica MaterialPeligroso = Sí pero no se especifica Embalaje.",
        "Captura el tipo de embalaje del material peligroso.",
        cpEvidence(merEvidence()),
      );
    }
  });

  // ── D) Reglas de Autotransporte (only if hasAutotransporte) ──
  if (cartaPorte.hasAutotransporte) {
    const auto = cartaPorte.autotransporte;

    // D1) Without PermSCT / NumPermisoSCT
    if (!auto || (!isNonEmptyString(auto.permSCT) || !isNonEmptyString(auto.numPermisoSCT))) {
      addFinding(
        "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_PERMISO",
        "WARNING",
        "Autotransporte sin permiso SCT",
        "El nodo Autotransporte no contiene PermSCT o NumPermisoSCT.",
        "Captura el permiso SCT y número de permiso correspondientes al autotransporte.",
        cpEvidence(),
      );
    }

    // D2) Without IdentificacionVehicular
    if (!auto?.identificacionVehicular) {
      addFinding(
        "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_VEHICULO",
        "WARNING",
        "Autotransporte sin identificación vehicular",
        "El nodo Autotransporte no contiene el submódulo IdentificacionVehicular.",
        "Captura los datos del vehículo (configuración, placa, año modelo).",
        cpEvidence(),
      );
    } else {
      const idV = auto.identificacionVehicular;

      // D3) Missing PlacaVM
      if (!isNonEmptyString(idV.placaVM)) {
        addFinding(
          "CARTA_PORTE_VEHICULO_MISSING_PLACA",
          "WARNING",
          "Vehículo sin placa",
          "IdentificacionVehicular no contiene PlacaVM.",
          "Captura el número de placa del vehículo.",
          cpEvidence(),
        );
      }

      // D4) Missing ConfigVehicular
      if (!isNonEmptyString(idV.configVehicular)) {
        addFinding(
          "CARTA_PORTE_VEHICULO_MISSING_CONFIG",
          "WARNING",
          "Vehículo sin configuración",
          "IdentificacionVehicular no contiene ConfigVehicular.",
          "Captura la clave de configuración vehicular (p. ej. C2, C3, etc.).",
          cpEvidence(),
        );
      }

      // D5) AnioModeloVM review
      const anioNum = toNum(idV.anioModeloVM);
      const currentYear = new Date().getFullYear();
      if (anioNum !== null && (anioNum < 1994 || anioNum > currentYear + 1)) {
        addFinding(
          "CARTA_PORTE_VEHICULO_YEAR_INVALID_REVIEW",
          "INFO",
          "Año modelo del vehículo requiere revisión",
          "El año modelo del vehículo está fuera del rango esperado (1994 - año siguiente).",
          "Revisa que el año modelo del vehículo sea correcto.",
          cpEvidence([{ label: "anioModeloVM", value: idV.anioModeloVM ?? "—" }]),
        );
      }
    }

    // D6) Without Seguros
    if (!auto?.seguros) {
      addFinding(
        "CARTA_PORTE_AUTOTRANSPORTE_WITHOUT_SEGURO_RC",
        "WARNING",
        "Autotransporte sin seguro de responsabilidad civil",
        "El nodo Autotransporte no contiene el submódulo Seguros.",
        "Captura la información del seguro de responsabilidad civil del autotransporte.",
        cpEvidence(),
      );
    }
  }

  // ── E) Reglas de Figuras de Transporte ──
  // Skip E1: existing CARTA_PORTE_NO_TRANSPORT_MODE_DETECTED covers no figuras detection
  if (cartaPorte.figurasTransporte.length > 0) {
    cartaPorte.figurasTransporte.forEach((fig, fIdx) => {
      const figNum = fIdx + 1;
      const figEvidence = (): { label: string; value?: string }[] => [
        { label: "figuraIndex", value: String(figNum) },
      ];

      // E2) Missing TipoFigura
      if (!isNonEmptyString(fig.tipoFigura)) {
        addFinding(
          "CARTA_PORTE_FIGURA_MISSING_TIPO",
          "WARNING",
          "Figura de transporte sin tipo",
          "Una figura de transporte no especifica TipoFigura.",
          "Revisa que la figura tenga un tipo asignado (01-05).",
          cpEvidence(figEvidence()),
        );
      }

      // E3) Missing RFC and NombreFigura
      if (!isNonEmptyString(fig.rfcFigura) && !isNonEmptyString(fig.nombreFigura)) {
        addFinding(
          "CARTA_PORTE_FIGURA_MISSING_RFC_OR_NAME",
          "WARNING",
          "Figura de transporte sin RFC ni nombre",
          "Una figura de transporte no contiene RFCFigura ni NombreFigura.",
          "Captura al menos el RFC o el nombre de la figura de transporte.",
          cpEvidence(figEvidence()),
        );
      }

      // E4) Operador without NumLicencia
      if (fig.tipoFigura === "03" && !isNonEmptyString(fig.numLicencia)) {
        addFinding(
          "CARTA_PORTE_OPERADOR_WITHOUT_LICENCIA",
          "WARNING",
          "Operador sin número de licencia",
          "Una figura de tipo Operador (03) no contiene NumLicencia.",
          "Captura el número de licencia del operador.",
          cpEvidence(figEvidence()),
        );
      }

      // E5) RFC genérico review
      if (
        isNonEmptyString(fig.rfcFigura) &&
        /^(XEXX010101000|XAXX010101000|XEXX010101001)$/i.test(fig.rfcFigura!)
      ) {
        addFinding(
          "CARTA_PORTE_FIGURA_RFC_GENERIC_REVIEW",
          "INFO",
          "Figura de transporte con RFC genérico",
          "Una figura de transporte utiliza un RFC genérico (XAXX/XEXX).",
          "Revisa si la figura debe contar con un RFC fiscal válido.",
          cpEvidence(figEvidence()),
        );
      }
    });
  }

  // ── F) Reglas de CFDI + Carta Porte (skip F1/F2: existentes) ──
  // No additional F rules beyond existing CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE
  //   and CARTA_PORTE_TRASLADO_TOTAL_NOT_ZERO
}
