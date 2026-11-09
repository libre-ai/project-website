// A real calendar day, not a shape: 2026-02-30 is refused. Shared by every dated field
// the site publishes (verification dates, review dates), so a bad date fails the same way everywhere.
export function isoDay(value: unknown, error: string): string {
  if (typeof value !== "string") throw new Error(error);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(error);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(error);
  }
  return value;
}
