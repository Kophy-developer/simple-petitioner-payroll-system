import type { DemoUser } from "@/lib/types";

function slugPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeEmployeeKey(employeeId: string) {
  const cleaned = employeeId.trim().replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return "";
  if (cleaned.startsWith("BAP-")) return cleaned;
  return `BAP-${cleaned}`;
}

export function personKeyFromProfile(
  person: Pick<DemoUser, "id" | "firstName" | "lastName" | "employeeId">,
  people?: Array<Pick<DemoUser, "id" | "firstName" | "lastName" | "employeeId">>,
) {
  const employee = person.employeeId ? normalizeEmployeeKey(person.employeeId) : "";
  if (employee) return employee;

  const nameSlug = slugPart(`${person.firstName} ${person.lastName}`);
  if (!nameSlug) return person.id;

  const collisions = (people ?? []).filter(
    (p) => !p.employeeId?.trim() && slugPart(`${p.firstName} ${p.lastName}`) === nameSlug,
  );
  if (collisions.length > 1) {
    return `${nameSlug}-${person.id.replace(/-/g, "").slice(-6)}`;
  }
  return nameSlug;
}

export function resolvePersonKey(
  key: string | null | undefined,
  people: Array<Pick<DemoUser, "id" | "firstName" | "lastName" | "employeeId">>,
) {
  if (!key) return null;
  const raw = decodeURIComponent(key).trim();
  if (!raw) return null;

  const byId = people.find((p) => p.id === raw);
  if (byId) return byId;

  const upper = normalizeEmployeeKey(raw);
  const byEmployee = people.find((p) => {
    if (!p.employeeId?.trim()) return false;
    return normalizeEmployeeKey(p.employeeId) === upper;
  });
  if (byEmployee) return byEmployee;

  const slug = slugPart(raw);
  const byGenerated = people.filter((p) => {
    const keyForPerson = personKeyFromProfile(p, people);
    return keyForPerson === raw || keyForPerson === slug;
  });
  if (byGenerated.length === 1) return byGenerated[0];

  const byName = people.filter((p) => slugPart(`${p.firstName} ${p.lastName}`) === slug);
  if (byName.length === 1) return byName[0];

  return null;
}

export function ledgerIndividualHref(
  person: Pick<DemoUser, "id" | "firstName" | "lastName" | "employeeId">,
  people?: Array<Pick<DemoUser, "id" | "firstName" | "lastName" | "employeeId">>,
) {
  const key = encodeURIComponent(personKeyFromProfile(person, people));
  return `/ledger?view=individual&person=${key}`;
}
