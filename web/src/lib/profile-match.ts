import { nameSimilarity } from "@/lib/name-similarity";

export type MatchProfile = {
  id: string;
  initials: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
};

export type ProfileMatchInput = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  initials?: string;
};

export type ProfileMatchMethod = "email" | "phone" | "name" | "fuzzy_name" | "initials";

export type ProfileMatchResult =
  | { status: "matched"; profile: MatchProfile; method: ProfileMatchMethod }
  | { status: "unmatched"; reason: string }
  | { status: "ambiguous"; reason: string };

const FUZZY_NAME_THRESHOLD = 0.85;

export function normalizePhoneDigits(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeMatchName(value: string) {
  let s = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s,.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  if (s.includes(",")) {
    const parts = s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const [last, ...rest] = parts;
      s = `${rest.join(" ")} ${last}`.replace(/\s+/g, " ").trim();
    }
  }
  return s.replace(/[.,']/g, "").replace(/\s+/g, " ").trim();
}

export function profileFullName(profile: Pick<MatchProfile, "firstName" | "lastName">) {
  return normalizeMatchName(`${profile.firstName} ${profile.lastName}`);
}

function decideUnique(
  matches: MatchProfile[],
  method: ProfileMatchMethod,
  ambiguousReason: string,
): ProfileMatchResult | null {
  if (matches.length === 1) {
    return { status: "matched", profile: matches[0], method };
  }
  if (matches.length > 1) {
    return { status: "ambiguous", reason: ambiguousReason };
  }
  return null;
}

export function matchProfile(
  input: ProfileMatchInput,
  profiles: MatchProfile[],
  opts?: { fuzzyThreshold?: number },
): ProfileMatchResult {
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = normalizePhoneDigits(input.phone ?? "");
  const initials = (input.initials ?? "").trim().toUpperCase();
  const assembledName = [input.firstName, input.lastName].filter(Boolean).join(" ");
  const rawName = (input.name ?? assembledName).trim();
  const name = normalizeMatchName(rawName);
  const threshold = opts?.fuzzyThreshold ?? FUZZY_NAME_THRESHOLD;

  if (!email && !phone && !name && !initials) {
    return { status: "unmatched", reason: "No name, email, phone, or initials to match" };
  }

  if (email) {
    const hits = profiles.filter((p) => p.email.trim().toLowerCase() === email);
    const result = decideUnique(hits, "email", `Ambiguous email match (${hits.length} profiles)`);
    if (result) return result;
  }

  if (phone.length >= 7) {
    const hits = profiles.filter((p) => {
      const candidate = normalizePhoneDigits(p.phone ?? "");
      if (!candidate) return false;
      if (candidate === phone) return true;
      if (candidate.length >= 10 && phone.length >= 10) {
        return candidate.slice(-10) === phone.slice(-10);
      }
      return false;
    });
    const result = decideUnique(hits, "phone", `Ambiguous phone match (${hits.length} profiles)`);
    if (result) return result;
  }

  if (name) {
    const exactHits = profiles.filter((p) => profileFullName(p) === name);
    const exact = decideUnique(
      exactHits,
      "name",
      `Ambiguous name match (${exactHits.length} profiles)`,
    );
    if (exact) return exact;

    const scored = profiles
      .map((p) => ({ profile: p, score: nameSimilarity(name, profileFullName(p)) }))
      .filter((row) => row.score >= threshold)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 1) {
      return { status: "matched", profile: scored[0].profile, method: "fuzzy_name" };
    }
    if (scored.length > 1) {
      return {
        status: "ambiguous",
        reason: `Ambiguous name match (${scored.length} similar profiles)`,
      };
    }
  }

  if (initials) {
    const hits = profiles.filter((p) => p.initials.trim().toUpperCase() === initials);
    const result = decideUnique(
      hits,
      "initials",
      `Ambiguous initials match (${hits.length} profiles)`,
    );
    if (result) return result;
  }

  if (email || phone || name) {
    return { status: "unmatched", reason: "No matching user by name, email, or phone" };
  }
  return { status: "unmatched", reason: "No matching user by initials" };
}
