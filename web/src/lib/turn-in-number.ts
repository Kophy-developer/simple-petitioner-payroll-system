export function formatTurnInNumber(state: string, dateIso: string) {
  const st = state.trim().toUpperCase().slice(0, 2);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso.trim());
  if (!st || !match) return "";
  return `${st}-${match[2]}-${match[3]}`;
}

export function isDateBasedTurnInNumber(value: string) {
  return /^[A-Z]{2}-\d{2}-\d{2}$/i.test(value.trim());
}

export function parseTurnInNumberDate(value: string, year = new Date().getFullYear()) {
  const match = /^([A-Z]{2})-(\d{2})-(\d{2})$/i.exec(value.trim());
  if (!match) return null;
  return `${year}-${match[2]}-${match[3]}`;
}
