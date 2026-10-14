export function toBusinessWallDate(instant: string, timezone: string): Date {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid scheduled timestamp.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (kind: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === kind)?.value);
  return new Date(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"));
}
