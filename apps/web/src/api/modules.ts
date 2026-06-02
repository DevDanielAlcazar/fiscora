export interface AvailableModule {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  beta: boolean;
  consumesUsage: boolean;
  allowSingleXml: boolean;
  allowZip: boolean;
}

interface AvailableModulesResponse {
  modules: AvailableModule[];
}

export async function getAvailableModules(token: string): Promise<AvailableModule[]> {
  const res = await fetch("/api/modules/available", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Error al consultar módulos disponibles");
  }

  const data: AvailableModulesResponse = await res.json();
  return data.modules;
}
