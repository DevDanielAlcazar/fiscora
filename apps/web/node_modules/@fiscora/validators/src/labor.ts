import { z } from "zod";

export const laborCalculationInputSchema = z.object({
  employeeId: z.string().uuid({ message: "ID de empleado inválido" }),
  calculationType: z.enum(["aguinaldo", "prima_vacacional", "finiquito", "liquidacion", "nomina"], {
    errorMap: () => ({ message: "Tipo de cálculo laboral no válido" }),
  }),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Fecha de inicio inválida",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Fecha de fin inválida",
  }),
  dailySalary: z.number().positive({ message: "El salario diario debe ser mayor a cero" }),
  daysWorked: z
    .number()
    .int()
    .positive({ message: "Los días laborados deben ser un entero positivo" })
    .optional(),
});

export type LaborCalculationInput = z.infer<typeof laborCalculationInputSchema>;
