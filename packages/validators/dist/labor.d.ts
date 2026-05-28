import { z } from "zod";
export declare const laborCalculationInputSchema: z.ZodObject<{
    employeeId: z.ZodString;
    calculationType: z.ZodEnum<["aguinaldo", "prima_vacacional", "finiquito", "liquidacion", "nomina"]>;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    dailySalary: z.ZodNumber;
    daysWorked: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    calculationType: "aguinaldo" | "prima_vacacional" | "finiquito" | "liquidacion" | "nomina";
    startDate: string;
    endDate: string;
    dailySalary: number;
    daysWorked?: number | undefined;
}, {
    employeeId: string;
    calculationType: "aguinaldo" | "prima_vacacional" | "finiquito" | "liquidacion" | "nomina";
    startDate: string;
    endDate: string;
    dailySalary: number;
    daysWorked?: number | undefined;
}>;
export type LaborCalculationInput = z.infer<typeof laborCalculationInputSchema>;
//# sourceMappingURL=labor.d.ts.map