export interface PlanFromApi {
  key: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number | null;
  yearlyPriceCents: number | null;
  currency: string;
  features: unknown;
  maxRfcProfiles: number;
  maxUsers: number;
  monthlyUsageLimit: number | null;
}

export async function getPlans(): Promise<{ plans: PlanFromApi[] }> {
  const res = await fetch("/api/plans");

  if (!res.ok) {
    throw new Error("Error al cargar planes");
  }

  return res.json();
}
