export function normalizePersonName(first?: string | null, last?: string | null) {
  const full = `${(first ?? "").trim()} ${(last ?? "").trim()}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return full || null;
}

function bigramCounts(value: string) {
  const counts = new Map<string, number>();
  if (value.length < 2) {
    if (value.length === 1) counts.set(value, 1);
    return counts;
  }
  for (let i = 0; i < value.length - 1; i += 1) {
    const gram = value.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function diceCoefficient(a: string, b: string) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aCounts = bigramCounts(a);
  const bCounts = bigramCounts(b);
  if (aCounts.size === 0 && bCounts.size === 0) return 1;
  if (aCounts.size === 0 || bCounts.size === 0) return 0;

  let overlap = 0;
  let aTotal = 0;
  let bTotal = 0;
  for (const count of aCounts.values()) aTotal += count;
  for (const count of bCounts.values()) bTotal += count;
  for (const [gram, aCount] of aCounts) {
    const bCount = bCounts.get(gram);
    if (bCount) overlap += Math.min(aCount, bCount);
  }
  return (2 * overlap) / (aTotal + bTotal);
}

export function nameSimilarity(a: string, b: string) {
  if (a === b) return 1;
  return diceCoefficient(a, b);
}
