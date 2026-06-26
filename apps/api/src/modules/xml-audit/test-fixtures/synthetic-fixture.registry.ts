import type { SyntheticFixtureCase } from "./xml-fixture.types.js";
import { PAGOS_SYNTHETIC_FIXTURES } from "./pagos-fixtures.js";
import { NOMINA_SYNTHETIC_FIXTURES } from "./nomina-fixtures.js";
import { CARTA_PORTE_SYNTHETIC_FIXTURES } from "./cartaporte-fixtures.js";
import { COMERCIO_EXTERIOR_SYNTHETIC_FIXTURES } from "./comercio-exterior-fixtures.js";
import { RETENCIONES_SYNTHETIC_FIXTURES } from "./retenciones-fixtures.js";

export const ALL_SYNTHETIC_XML_FIXTURES: SyntheticFixtureCase[] = [
  ...PAGOS_SYNTHETIC_FIXTURES,
  ...NOMINA_SYNTHETIC_FIXTURES,
  ...CARTA_PORTE_SYNTHETIC_FIXTURES,
  ...COMERCIO_EXTERIOR_SYNTHETIC_FIXTURES,
  ...RETENCIONES_SYNTHETIC_FIXTURES,
];

export function getSyntheticFixtures(): SyntheticFixtureCase[] {
  return ALL_SYNTHETIC_XML_FIXTURES.map((f) => ({ ...f }));
}

export function getSyntheticFixturesByKind(kind: SyntheticFixtureCase["kind"]): SyntheticFixtureCase[] {
  return ALL_SYNTHETIC_XML_FIXTURES.filter((f) => f.kind === kind).map((f) => ({ ...f }));
}

export function findSyntheticFixtureById(id: string): SyntheticFixtureCase | undefined {
  return ALL_SYNTHETIC_XML_FIXTURES.find((f) => f.id === id);
}

export function getSyntheticFixtureSummary(): {
  total: number;
  byKind: Record<string, number>;
  tags: string[];
} {
  const byKind: Record<string, number> = {};
  for (const f of ALL_SYNTHETIC_XML_FIXTURES) {
    byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  }
  return {
    total: ALL_SYNTHETIC_XML_FIXTURES.length,
    byKind,
    tags: [...new Set(ALL_SYNTHETIC_XML_FIXTURES.flatMap((f) => f.tags))],
  }
}

export function validateSyntheticFixturesIntegrity(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = ALL_SYNTHETIC_XML_FIXTURES.map((f) => f.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    errors.push("IDs duplicados en fixtures");
  }

  for (const f of ALL_SYNTHETIC_XML_FIXTURES) {
    if (!f.name || f.name.trim() === "") {
      errors.push(`Fixture ${f.id} sin nombre`);
    }
    if (!f.xml.includes("SYNTHETIC_TEST_ONLY")) {
      errors.push(`Fixture ${f.id} no contiene marcador SYNTHETIC_TEST_ONLY`);
    }
    const hasRealRfc = /([A-Z]{4}[0-9]{6}[A-Z0-9]{3})/.test(f.xml);
    if (hasRealRfc && !["AAA010101AAA", "XAXX010101000", "BBB010101BBB"].some((r) => f.xml.includes(r))) {
      errors.push(`Fixture ${f.id} podría contener RFC real`);
    }
    if (f.xml.length > 200 && f.xml.includes("MIIC") && !f.xml.includes("sig") && !f.xml.includes("MII...")) {
      errors.push(`Fixture ${f.id} podría contener certificado real`);
    }
    if (f.tags.length === 0) {
      errors.push(`Fixture ${f.id} sin tags`);
    }
  }

  return { valid: errors.length === 0, errors };
}