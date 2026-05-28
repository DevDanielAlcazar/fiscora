import { getDefaultRuleSet } from "../rule-set.js";
/**
 * Perform LFT labor calculations (aguinaldo, vacation premium, severance, etc.).
 * This is a typed placeholder implementation.
 */
export function calculateLabor(input) {
    const ruleSet = input.ruleSet || getDefaultRuleSet();
    const concepts = [];
    const daily = input.dailySalary;
    if (input.calculationType === "aguinaldo") {
        const days = input.daysWorked !== undefined ? Math.min(365, input.daysWorked) : 365;
        const proportionalDays = (days / 365) * ruleSet.aguinaldoMinDays;
        const amount = proportionalDays * daily;
        concepts.push({
            conceptCode: "AGUINALDO",
            conceptName: "Aguinaldo Proporcional",
            type: "PERCEPTION",
            amount,
            isTaxable: amount > ruleSet.umaValue * 30, // Exemption threshold (30 UMA)
        });
    }
    else if (input.calculationType === "prima_vacacional") {
        const vacationDays = 12; // LFT year 1 minimum baseline
        const amount = vacationDays * daily * ruleSet.vacationPremiumPercent;
        concepts.push({
            conceptCode: "PRIMA_VAC",
            conceptName: "Prima Vacacional",
            type: "PERCEPTION",
            amount,
            isTaxable: amount > ruleSet.umaValue * 15, // Exemption threshold (15 UMA)
        });
    }
    else {
        concepts.push({
            conceptCode: "BASE_SALARY",
            conceptName: "Salario Base (MOCK)",
            type: "PERCEPTION",
            amount: daily * (input.daysWorked || 15),
            isTaxable: true,
        });
    }
    // Calculate simple mock taxes and withholdings
    const totalPerceptions = concepts.reduce((acc, c) => acc + (c.type === "PERCEPTION" ? c.amount : 0), 0);
    const isrAmount = totalPerceptions * 0.16; // 16% flat rate placeholder
    const imssAmount = totalPerceptions * 0.025; // 2.5% standard IMSS worker fee placeholder
    concepts.push({
        conceptCode: "ISR_RET",
        conceptName: "Retención de ISR (MOCK)",
        type: "DEDUCTION",
        amount: isrAmount,
        isTaxable: false,
    });
    concepts.push({
        conceptCode: "IMSS_RET",
        conceptName: "Seguridad Social IMSS (MOCK)",
        type: "DEDUCTION",
        amount: imssAmount,
        isTaxable: false,
    });
    const totalDeductions = isrAmount + imssAmount;
    return {
        calculationId: "calc_" + Math.random().toString(36).substring(2, 11),
        employeeId: input.employeeId,
        type: input.calculationType,
        calculationDate: new Date().toISOString(),
        input,
        concepts,
        totalPerceptions,
        totalDeductions,
        netPay: totalPerceptions - totalDeductions,
        appliedRuleSet: ruleSet,
    };
}
//# sourceMappingURL=mexican-lft-calculator.js.map