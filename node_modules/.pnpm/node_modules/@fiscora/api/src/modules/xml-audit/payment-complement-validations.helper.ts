import type { PaymentComplement, PaymentInfo, PaymentDocument } from "./xml-audit.service.js";

function toStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val).trim();
}

function toNum(val: string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function moneyDiff(a: number, b: number): number {
  return Math.abs(Math.round(a * 100) - Math.round(b * 100)) / 100;
}

function toMoneyNumber(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

type FindingAdder = (
  code: string,
  severity: "CRITICAL" | "WARNING" | "INFO",
  title: string,
  message: string,
  recommendedAction: string,
  evidence: { label: string; value?: string }[],
) => void;

export interface PaymentComplementAdvancedContext {
  paymentComplement: PaymentComplement | null;
  addFinding: FindingAdder;
}

export function validatePaymentComplementAdvanced(ctx: PaymentComplementAdvancedContext): void {
  const { paymentComplement, addFinding } = ctx;

  if (!paymentComplement || !paymentComplement.pagos) return;

  paymentComplement.pagos.forEach((pago: PaymentInfo, pagoIdx: number) => {
    const pagoNum = pagoIdx + 1;
    const monedaP = toStr(pago.monedaP) ?? "";
    const monto = toStr(pago.monto) ?? "";

    function pagoEvidence(
      extra?: { label: string; value?: string }[],
    ): { label: string; value?: string }[] {
      return [
        { label: "pagoIndex", value: String(pagoNum) },
        { label: "monedaP", value: monedaP || "—" },
        { label: "montoPago", value: monto || "—" },
        ...(extra ?? []),
      ];
    }

    // A1) FechaPago missing
    if (!isNonEmptyString(pago.fechaPago)) {
      addFinding(
        "PAYMENT_DATE_MISSING",
        "WARNING",
        "Fecha de pago faltante",
        "Un pago del complemento no contiene FechaPago.",
        "Verifica la fecha del pago en el complemento de pagos.",
        pagoEvidence(),
      );
    }

    // A2) FechaPago invalid format
    if (isNonEmptyString(pago.fechaPago)) {
      const d = new Date(pago.fechaPago!);
      if (isNaN(d.getTime())) {
        addFinding(
          "PAYMENT_DATE_INVALID_REVIEW",
          "WARNING",
          "Fecha de pago inválida",
          "La FechaPago del pago no tiene un formato de fecha válido.",
          "Revisa el formato de la fecha en el complemento de pagos.",
          pagoEvidence([{ label: "FechaPago", value: pago.fechaPago! }]),
        );
      }
    }

    // A3) FormaDePagoP missing
    if (!isNonEmptyString(pago.formaDePagoP)) {
      addFinding(
        "PAYMENT_FORMA_PAGO_MISSING",
        "WARNING",
        "Forma de pago faltante",
        "Un pago del complemento no contiene FormaDePagoP.",
        "Verifica la forma de pago en el complemento.",
        pagoEvidence(),
      );
    }

    // A4) MonedaP missing
    if (!isNonEmptyString(pago.monedaP)) {
      addFinding(
        "PAYMENT_MONEDA_MISSING",
        "WARNING",
        "Moneda del pago faltante",
        "Un pago del complemento no contiene MonedaP.",
        "Verifica la moneda del pago en el complemento.",
        pagoEvidence(),
      );
    }

    // A5) Monto missing
    if (!isNonEmptyString(pago.monto)) {
      addFinding(
        "PAYMENT_AMOUNT_MISSING",
        "WARNING",
        "Monto del pago faltante",
        "Un pago del complemento no contiene Monto.",
        "Verifica el monto del pago en el complemento.",
        pagoEvidence(),
      );
    }

    // A6) Monto non-positive - reuse existing PAYMENT_AMOUNT_NON_POSITIVE
    const montoNum = toMoneyNumber(pago.monto);
    if (isNonEmptyString(pago.monto) && montoNum <= 0) {
      addFinding(
        "PAYMENT_AMOUNT_NON_POSITIVE",
        "WARNING",
        "Monto del pago no positivo",
        "El monto del pago debe ser mayor a cero.",
        "Revisa el importe del pago capturado en el REP.",
        pagoEvidence([{ label: "Monto", value: pago.monto! }]),
      );
    }

    // A7) TipoCambioP required for foreign currency
    if (
      isNonEmptyString(pago.monedaP) &&
      monedaP.toUpperCase() !== "MXN" &&
      monedaP.toUpperCase() !== "XXX" &&
      !isNonEmptyString(pago.tipoCambioP)
    ) {
      addFinding(
        "PAYMENT_TIPO_CAMBIO_REQUIRED_REVIEW",
        "WARNING",
        "Tipo de cambio requerido para moneda extranjera",
        "El pago está en moneda distinta de MXN, pero no se detectó TipoCambioP.",
        "Agrega el tipo de cambio correspondiente.",
        pagoEvidence([{ label: "MonedaP", value: monedaP }]),
      );
    }

    // A8) TipoCambioP with MXN
    if (
      monedaP.toUpperCase() === "MXN" &&
      isNonEmptyString(pago.tipoCambioP) &&
      Math.abs(toMoneyNumber(pago.tipoCambioP) - 1) > 0.01
    ) {
      addFinding(
        "PAYMENT_TIPO_CAMBIO_WITH_MXN_REVIEW",
        "INFO",
        "Tipo de cambio en pago MXN",
        "El pago está en MXN pero incluye TipoCambioP distinto de 1.",
        "Verifica si el tipo de cambio es correcto.",
        pagoEvidence([
          { label: "MonedaP", value: monedaP },
          { label: "TipoCambioP", value: pago.tipoCambioP! },
        ]),
      );
    }

    // A9) MonedaP = XXX - reuse existing PAYMENT_CURRENCY_XXX
    if (monedaP.toUpperCase() === "XXX") {
      addFinding(
        "PAYMENT_CURRENCY_XXX",
        "WARNING",
        "MonedaP no debe ser XXX",
        "En el detalle del pago, MonedaP normalmente debe indicar la moneda real del pago y no XXX.",
        "Valida la moneda del pago en el complemento Pagos.",
        pagoEvidence([{ label: "MonedaP", value: monedaP }]),
      );
    }

    // B) Document-level findings
    pago.documentosRelacionados.forEach((doc: PaymentDocument, docIdx: number) => {
      const docNum = docIdx + 1;
      const monedaDR = toStr(doc.monedaDR) ?? "";
      const equivalenciaDR = toStr(doc.equivalenciaDR) ?? "";
      const impSaldoAnt = toStr(doc.impSaldoAnt) ?? "";
      const impPagado = toStr(doc.impPagado) ?? "";
      const impSaldoInsoluto = toStr(doc.impSaldoInsoluto) ?? "";
      const objetoImpDR = toStr(doc.objetoImpDR) ?? "";

      function docEvidence(
        extra?: { label: string; value?: string }[],
      ): { label: string; value?: string }[] {
        return [
          ...pagoEvidence(),
          { label: "documentoIndex", value: String(docNum) },
          { label: "idDocumento", value: doc.idDocumento ?? "—" },
          { label: "monedaDR", value: monedaDR || "—" },
          { label: "equivalenciaDR", value: equivalenciaDR || "—" },
          { label: "impSaldoAnt", value: impSaldoAnt || "—" },
          { label: "impPagado", value: impPagado || "—" },
          { label: "impSaldoInsoluto", value: impSaldoInsoluto || "—" },
          ...(extra ?? []),
        ];
      }

      // B1) IdDocumento missing - reuse RELATED_DOCUMENT_MISSING_UUID
      if (!isNonEmptyString(doc.idDocumento)) {
        addFinding(
          "RELATED_DOCUMENT_MISSING_UUID",
          "WARNING",
          "Documento relacionado sin UUID",
          "Un documento relacionado del REP no contiene IdDocumento.",
          "Verifica que cada documento relacionado incluya el UUID del CFDI pagado.",
          docEvidence(),
        );
      }

      // B2) MonedaDR missing - reuse RELATED_DOCUMENT_MISSING_MONEDA
      if (!isNonEmptyString(doc.monedaDR)) {
        addFinding(
          "RELATED_DOCUMENT_MISSING_MONEDA",
          "WARNING",
          "Moneda del documento relacionado faltante",
          "Un documento relacionado no contiene MonedaDR.",
          "Valida la moneda del documento relacionado dentro del REP.",
          docEvidence(),
        );
      }

      // B3) EquivalenciaDR required when currencies differ
      if (
        isNonEmptyString(doc.monedaDR) &&
        isNonEmptyString(pago.monedaP) &&
        monedaDR.toUpperCase() !== monedaP.toUpperCase() &&
        !isNonEmptyString(doc.equivalenciaDR)
      ) {
        addFinding(
          "RELATED_DOCUMENT_EQUIVALENCIA_REQUIRED_REVIEW",
          "WARNING",
          "Equivalencia requerida por diferencia de monedas",
          "La moneda del documento difiere de la moneda del pago y no se proporcionó EquivalenciaDR.",
          "Agrega EquivalenciaDR al documento relacionado.",
          docEvidence(),
        );
      }

      // B4) EquivalenciaDR with same currency
      if (
        isNonEmptyString(doc.monedaDR) &&
        isNonEmptyString(pago.monedaP) &&
        monedaDR.toUpperCase() === monedaP.toUpperCase() &&
        isNonEmptyString(doc.equivalenciaDR) &&
        Math.abs(toMoneyNumber(doc.equivalenciaDR) - 1) > 0.01
      ) {
        addFinding(
          "RELATED_DOCUMENT_EQUIVALENCIA_WITH_SAME_CURRENCY_REVIEW",
          "INFO",
          "Equivalencia distinta de 1 con misma moneda",
          "El documento relacionado tiene EquivalenciaDR distinta de 1 aunque MonedaDR coincide con MonedaP.",
          "Verifica si la equivalencia es correcta.",
          docEvidence([{ label: "EquivalenciaDR", value: doc.equivalenciaDR! }]),
        );
      }

      // B5) NumParcialidad missing
      if (!isNonEmptyString(doc.numParcialidad)) {
        addFinding(
          "RELATED_DOCUMENT_NUM_PARCIALIDAD_MISSING_REVIEW",
          "WARNING",
          "Número de parcialidad faltante",
          "Un documento relacionado no contiene NumParcialidad.",
          "Agrega el número de parcialidad correspondiente.",
          docEvidence(),
        );
      }

      // B6) NumParcialidad non-positive
      const numParcialidadNum = toNum(doc.numParcialidad);
      if (numParcialidadNum !== null && numParcialidadNum <= 0) {
        addFinding(
          "RELATED_DOCUMENT_NUM_PARCIALIDAD_NON_POSITIVE",
          "WARNING",
          "Número de parcialidad no positivo",
          "El número de parcialidad del documento relacionado debe ser mayor a cero.",
          "Revisa el valor de NumParcialidad.",
          docEvidence([{ label: "NumParcialidad", value: doc.numParcialidad! }]),
        );
      }

      // B7) ImpSaldoAnt missing
      if (!isNonEmptyString(doc.impSaldoAnt)) {
        addFinding(
          "RELATED_DOCUMENT_PREVIOUS_BALANCE_MISSING",
          "WARNING",
          "Saldo anterior faltante",
          "Un documento relacionado no contiene ImpSaldoAnt.",
          "Agrega el saldo anterior del documento.",
          docEvidence(),
        );
      }

      // B8) ImpPagado missing
      if (!isNonEmptyString(doc.impPagado)) {
        addFinding(
          "RELATED_DOCUMENT_PAID_AMOUNT_MISSING",
          "WARNING",
          "Importe pagado faltante",
          "Un documento relacionado no contiene ImpPagado.",
          "Agrega el importe pagado del documento.",
          docEvidence(),
        );
      }

      // B9) ImpSaldoInsoluto missing
      if (!isNonEmptyString(doc.impSaldoInsoluto)) {
        addFinding(
          "RELATED_DOCUMENT_REMAINING_BALANCE_MISSING",
          "WARNING",
          "Saldo insoluto faltante",
          "Un documento relacionado no contiene ImpSaldoInsoluto.",
          "Agrega el saldo insoluto del documento.",
          docEvidence(),
        );
      }

      // B10) Balance formula mismatch - reuse RELATED_DOCUMENT_BALANCE_MISMATCH
      const saldoAntNum = toMoneyNumber(doc.impSaldoAnt);
      const pagadoNum = toMoneyNumber(doc.impPagado);
      const insolutoNum = toMoneyNumber(doc.impSaldoInsoluto);
      if (
        isNonEmptyString(doc.impSaldoAnt) &&
        isNonEmptyString(doc.impPagado) &&
        isNonEmptyString(doc.impSaldoInsoluto)
      ) {
        const expectedBalance = Math.round((saldoAntNum - pagadoNum) * 100) / 100;
        if (moneyDiff(insolutoNum, expectedBalance) > 0.01) {
          addFinding(
            "RELATED_DOCUMENT_BALANCE_MISMATCH",
            "CRITICAL",
            "Saldo insoluto no coincide",
            "El saldo insoluto del documento relacionado no coincide con saldo anterior menos importe pagado.",
            "Revisa los importes ImpSaldoAnt, ImpPagado e ImpSaldoInsoluto.",
            docEvidence([
              { label: "Saldo calculado", value: String(expectedBalance) },
              { label: "difference", value: String(moneyDiff(insolutoNum, expectedBalance)) },
            ]),
          );
        }
      }

      // B11) Paid exceeds previous balance - reuse RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE
      if (
        isNonEmptyString(doc.impSaldoAnt) &&
        isNonEmptyString(doc.impPagado) &&
        pagadoNum > saldoAntNum + 0.01
      ) {
        addFinding(
          "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE",
          "CRITICAL",
          "Importe pagado mayor al saldo anterior",
          "El importe pagado del documento relacionado es mayor al saldo anterior.",
          "Valida los importes del REP.",
          docEvidence([
            {
              label: "difference",
              value: String(Math.round((pagadoNum - saldoAntNum) * 100) / 100),
            },
          ]),
        );
      }

      // B12) Remaining balance negative - reuse RELATED_DOCUMENT_BALANCE_NEGATIVE
      if (
        (isNonEmptyString(doc.impSaldoAnt) && saldoAntNum < 0) ||
        (isNonEmptyString(doc.impSaldoInsoluto) && insolutoNum < 0)
      ) {
        addFinding(
          "RELATED_DOCUMENT_BALANCE_NEGATIVE",
          "WARNING",
          "Saldo negativo en documento relacionado",
          "El documento relacionado contiene saldo anterior o saldo insoluto negativo.",
          "Verifica los saldos del documento relacionado.",
          docEvidence(),
        );
      }

      // B13) ObjetoImpDR missing
      if (!isNonEmptyString(doc.objetoImpDR)) {
        addFinding(
          "RELATED_DOCUMENT_OBJECT_IMP_MISSING_REVIEW",
          "WARNING",
          "ObjetoImpDR faltante en documento relacionado",
          "Un documento relacionado no contiene ObjetoImpDR.",
          "Agrega el ObjetoImpDR correspondiente.",
          docEvidence(),
        );
      }

      // B14) ObjetoImpDR 01 with DR taxes
      if (objetoImpDR === "01" && doc.impuestosDR) {
        const hasTaxes =
          (doc.impuestosDR.trasladosDR?.length ?? 0) > 0 ||
          (doc.impuestosDR.retencionesDR?.length ?? 0) > 0;
        if (hasTaxes) {
          addFinding(
            "RELATED_DOCUMENT_OBJECT_IMP_01_WITH_TAXES_REVIEW",
            "WARNING",
            "ObjetoImpDR 01 con impuestos DR",
            "Un documento con ObjetoImpDR 01 no debe tener impuestos DR asociados.",
            "Revisa el ObjetoImpDR o los impuestos del documento relacionado.",
            docEvidence([{ label: "objetoImpDR", value: objetoImpDR }]),
          );
        }
      }

      // B15) ObjetoImpDR 02 without DR taxes
      if (objetoImpDR === "02") {
        const hasNoTaxes =
          !doc.impuestosDR ||
          ((doc.impuestosDR.trasladosDR?.length ?? 0) === 0 &&
            (doc.impuestosDR.retencionesDR?.length ?? 0) === 0);
        if (hasNoTaxes) {
          addFinding(
            "RELATED_DOCUMENT_OBJECT_IMP_02_WITHOUT_TAXES_REVIEW",
            "WARNING",
            "ObjetoImpDR 02 sin impuestos DR",
            "Un documento con ObjetoImpDR 02 debe incluir impuestos DR.",
            "Agrega los impuestos correspondientes al documento relacionado.",
            docEvidence([{ label: "objetoImpDR", value: objetoImpDR }]),
          );
        }
      }

      // B16) ObjetoImpDR 03 with tax amount > 0
      if (objetoImpDR === "03" && doc.impuestosDR) {
        const hasAmount = [
          ...(doc.impuestosDR.trasladosDR ?? []),
          ...(doc.impuestosDR.retencionesDR ?? []),
        ].some((t) => toMoneyNumber(t.importeDR) > 0);
        if (hasAmount) {
          addFinding(
            "RELATED_DOCUMENT_OBJECT_IMP_03_WITH_TAX_AMOUNT_REVIEW",
            "WARNING",
            "ObjetoImpDR 03 con impuestos DR con importe",
            "Un documento con ObjetoImpDR 03 no debe tener impuestos DR con importe mayor a cero.",
            "Revisa el ObjetoImpDR o los importes de impuestos del documento relacionado.",
            docEvidence([{ label: "objetoImpDR", value: objetoImpDR }]),
          );
        }
      }

      // D) DR Tax entry findings
      const allDrTaxes = [
        ...(doc.impuestosDR?.trasladosDR ?? []),
        ...(doc.impuestosDR?.retencionesDR ?? []),
      ];

      allDrTaxes.forEach((tax, taxIdx) => {
        const taxBase = toStr(tax.baseDR) ?? "";
        const taxImpuesto = toStr(tax.impuestoDR) ?? "";
        const taxFactor = toStr(tax.tipoFactorDR) ?? "";
        const taxRate = toStr(tax.tasaOCuotaDR) ?? "";
        const taxImporte = toStr(tax.importeDR) ?? "";

        function taxEvidence(
          extra?: { label: string; value?: string }[],
        ): { label: string; value?: string }[] {
          return [
            ...docEvidence(),
            { label: "impuestoDR", value: taxImpuesto || "—" },
            { label: "tipoFactor", value: taxFactor || "—" },
            { label: "tasa", value: taxRate || "—" },
            { label: "baseDR", value: taxBase || "—" },
            { label: "importeDR", value: taxImporte || "—" },
            ...(extra ?? []),
          ];
        }

        // D1) BaseDR non-positive with positive ImporteDR
        const taxBaseNum = toMoneyNumber(tax.baseDR);
        const taxImporteNum = toMoneyNumber(tax.importeDR);
        if (taxBaseNum <= 0 && taxImporteNum > 0) {
          addFinding(
            "PAYMENT_RELATED_TAX_BASE_NON_POSITIVE",
            "WARNING",
            "Base de impuesto DR no positiva con importe positivo",
            "Un impuesto DR tiene BaseDR <= 0 pero ImporteDR > 0.",
            "Revisa la base del impuesto DR.",
            taxEvidence(),
          );
        }

        // D2) Rate/amount mismatch
        if (
          isNonEmptyString(tax.baseDR) &&
          isNonEmptyString(tax.tasaOCuotaDR) &&
          isNonEmptyString(tax.importeDR)
        ) {
          const expectedImporte = Math.round(taxBaseNum * taxImporteNum * 100) / 100;
          const actualImporte = taxImporteNum;
          const importeFromRate =
            Math.round(taxBaseNum * toMoneyNumber(tax.tasaOCuotaDR) * 100) / 100;
          if (moneyDiff(importeFromRate, actualImporte) > 0.01) {
            addFinding(
              "PAYMENT_RELATED_TAX_RATE_MISMATCH",
              "WARNING",
              "Tasa/Importe DR inconsistente",
              "El importe del impuesto DR no coincide con BaseDR * TasaOCuotaDR.",
              "Revisa los valores del impuesto DR.",
              taxEvidence([
                { label: "Importe calculado", value: String(importeFromRate) },
                { label: "difference", value: String(moneyDiff(importeFromRate, actualImporte)) },
              ]),
            );
          }
        }

        // D3) Missing ImpuestoDR
        if (!isNonEmptyString(tax.impuestoDR)) {
          addFinding(
            "PAYMENT_RELATED_TAX_MISSING_TAX_CODE",
            "WARNING",
            "Código de impuesto DR faltante",
            "Un impuesto DR no tiene ImpuestoDR.",
            "Agrega el código de impuesto correspondiente.",
            taxEvidence(),
          );
        }

        // D4) Missing TipoFactorDR
        if (!isNonEmptyString(tax.tipoFactorDR)) {
          addFinding(
            "PAYMENT_RELATED_TAX_MISSING_FACTOR",
            "WARNING",
            "TipoFactor DR faltante",
            "Un impuesto DR no tiene TipoFactorDR.",
            "Agrega el tipo de factor correspondiente.",
            taxEvidence(),
          );
        }

        // D5) Missing TasaOCuotaDR for Tasa factor
        if (taxFactor.toUpperCase() === "TASA" && !isNonEmptyString(tax.tasaOCuotaDR)) {
          addFinding(
            "PAYMENT_RELATED_TAX_MISSING_RATE_FOR_TASA",
            "WARNING",
            "TasaOCuotaDR faltante para TipoFactor Tasa",
            "Un impuesto DR con TipoFactor Tasa no tiene TasaOCuotaDR.",
            "Agrega la tasa o cuota correspondiente.",
            taxEvidence(),
          );
        }

        // D6) Exento with ImporteDR > 0
        if (taxFactor.toUpperCase() === "EXENTO" && taxImporteNum > 0) {
          addFinding(
            "PAYMENT_RELATED_TAX_EXENTO_WITH_AMOUNT",
            "WARNING",
            "Impuesto DR exento con importe positivo",
            "Un impuesto DR con TipoFactor Exento tiene ImporteDR > 0.",
            "Revisa si el impuesto debe ser exento o si el importe es correcto.",
            taxEvidence(),
          );
        }
      });
    });

    // C) Pago-level consistency

    // C1) Sum of ImpPagado exceeds Monto - reuse existing code
    // Skip if servicio ya lo maneja en lines 4484-4565

    // C2) Sum of ImpPagado < Monto (significant difference)
    if (pago.documentosRelacionados.length > 0 && isNonEmptyString(pago.monto)) {
      const allDocsComparable = pago.documentosRelacionados.every((doc) => {
        const docMoneda = toStr(doc.monedaDR)?.toUpperCase() ?? "";
        const docEquivalencia = toStr(doc.equivalenciaDR) ?? "";
        return (
          isNonEmptyString(doc.impPagado) &&
          (docMoneda === monedaP.toUpperCase() ||
            docMoneda === "" ||
            !isNonEmptyString(doc.monedaDR)) &&
          (docEquivalencia === "" || docEquivalencia === "1")
        );
      });

      if (allDocsComparable) {
        const sumPagado = pago.documentosRelacionados.reduce(
          (acc, doc) => acc + toMoneyNumber(doc.impPagado),
          0,
        );
        if (sumPagado > montoNum + 0.01) {
          addFinding(
            "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT",
            "CRITICAL",
            "Importes relacionados exceden el monto del pago",
            "La suma de importes pagados en documentos relacionados excede el monto del pago.",
            "Revisa el monto del pago y los importes aplicados a documentos relacionados.",
            pagoEvidence([
              { label: "Suma ImpPagado", value: String(sumPagado) },
              { label: "Monto pago", value: pago.monto! },
              {
                label: "difference",
                value: String(Math.round((sumPagado - montoNum) * 100) / 100),
              },
            ]),
          );
        } else if (montoNum - sumPagado > 0.01) {
          addFinding(
            "PAYMENT_TOTAL_RELATED_PAID_REVIEW",
            "INFO",
            "Importes relacionados menores al monto del pago",
            "La suma de importes pagados en documentos relacionados es menor al monto del pago.",
            "Revisa si hay documentos relacionados faltantes o si el monto del pago es correcto.",
            pagoEvidence([
              { label: "Suma ImpPagado", value: String(sumPagado) },
              { label: "Monto pago", value: pago.monto! },
            ]),
          );
        }
      }
    }

    // C3) Multiple currencies among related documents
    if (pago.documentosRelacionados.length >= 2) {
      const currencies = new Set(
        pago.documentosRelacionados
          .map((d) => toStr(d.monedaDR)?.toUpperCase() ?? "")
          .filter(Boolean),
      );
      if (currencies.size > 1) {
        addFinding(
          "PAYMENT_WITH_MULTIPLE_RELATED_CURRENCIES_REVIEW",
          "INFO",
          "Pago con documentos en múltiples monedas",
          "El pago contiene documentos relacionados con diferentes monedas.",
          "Verifica que las equivalencias y tipos de cambio sean correctos.",
          pagoEvidence([
            {
              label: "Monedas DR detectadas",
              value: [...currencies].join(", "),
            },
          ]),
        );
      }
    }

    // C4) Without related documents - reuse existing PAYMENT_WITHOUT_RELATED_DOCUMENTS
    if (pago.documentosRelacionados.length === 0) {
      addFinding(
        "PAYMENT_WITHOUT_RELATED_DOCUMENTS",
        "WARNING",
        "Pago sin documentos relacionados",
        "Se detectó un pago dentro del complemento, pero no contiene documentos relacionados.",
        "Revisa que el REP incluya los CFDI relacionados al pago.",
        pagoEvidence(),
      );
    }
  });

  // D7) Totales present without DR taxes
  if (paymentComplement.totales && Object.keys(paymentComplement.totales).length > 0) {
    const hasDrTaxes = paymentComplement.pagos.some((p) =>
      p.documentosRelacionados.some(
        (d) =>
          d.impuestosDR &&
          ((d.impuestosDR.trasladosDR?.length ?? 0) > 0 ||
            (d.impuestosDR.retencionesDR?.length ?? 0) > 0),
      ),
    );
    if (!hasDrTaxes) {
      addFinding(
        "PAYMENT_TOTAL_TAXES_PRESENT_WITHOUT_RELATED_TAXES_REVIEW",
        "INFO",
        "Totales de impuestos presentes sin impuestos DR",
        "El complemento de pagos reporta totales de impuestos, pero no se detectaron impuestos DR en los documentos relacionados.",
        "Verifica que los impuestos DR estén correctamente capturados.",
        [{ label: "MontoTotalPagos", value: paymentComplement.totales.montoTotalPagos ?? "—" }],
      );
    }
  }
}
