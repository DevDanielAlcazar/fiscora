export type LaborCalculationType =
  | "aguinaldo"
  | "prima_vacacional"
  | "finiquito"
  | "liquidacion"
  | "nomina";

export interface LaborRuleSet {
  year: number;
  minimumWage: number;
  umaValue: number; // Unidad de Medida y Actualización
  aguinaldoMinDays: number; // Mexican Law default is 15
  vacationPremiumPercent: number; // Mexican Law default is 0.25 (25%)
}

export interface LaborCalculationInput {
  employeeId: string;
  calculationType: LaborCalculationType;
  startDate: string;
  endDate: string;
  dailySalary: number;
  daysWorked?: number;
  ruleSet?: LaborRuleSet;
}

export interface LaborConceptBreakdown {
  conceptCode: string;
  conceptName: string;
  type: "PERCEPTION" | "DEDUCTION";
  amount: number;
  isTaxable: boolean;
}

export interface LaborCalculationResult {
  calculationId: string;
  employeeId: string;
  type: LaborCalculationType;
  calculationDate: string;
  input: LaborCalculationInput;
  concepts: LaborConceptBreakdown[];
  totalPerceptions: number;
  totalDeductions: number;
  netPay: number;
  appliedRuleSet: LaborRuleSet;
}
