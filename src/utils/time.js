import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export function toUtcIsoFromLocalInput(datetimeLocal) {
  if (!datetimeLocal) return "";
  const parsed = dayjs(datetimeLocal);
  if (!parsed.isValid()) return "";
  return parsed.utc().toISOString();
}

export function formatUtcForTimezone(utcIso, timezoneName) {
  if (!utcIso) return "Invalid slot";

  const date = dayjs.utc(utcIso);
  if (!date.isValid()) return "Invalid slot";

  const output = timezoneName ? date.tz(timezoneName) : date.local();
  return output.format("ddd, MMM D, YYYY h:mm A");
}

export function formatUtcRangeForTimezone(utcIso, durationMinutes, timezoneName) {
  if (!utcIso) return "Invalid slot";

  const date = dayjs.utc(utcIso);
  if (!date.isValid()) return "Invalid slot";

  const start = timezoneName ? date.tz(timezoneName) : date.local();
  const end = start.add(Number(durationMinutes) || 60, "minute");
  const sameDay = start.isSame(end, "day");

  if (sameDay) {
    return `${start.format("ddd, MMM D, YYYY h:mm A")} - ${end.format("h:mm A")}`;
  }

  return `${start.format("ddd, MMM D, YYYY h:mm A")} - ${end.format("ddd, MMM D, YYYY h:mm A")}`;
}

export function slotBoundsForTimezone(utcIso, durationMinutes, timezoneName) {
  const date = dayjs.utc(utcIso);
  if (!date.isValid()) return null;

  const start = timezoneName ? date.tz(timezoneName) : date.local();
  const end = start.add(Number(durationMinutes) || 60, "minute");

  return {
    start,
    end,
    dayKey: start.format("YYYY-MM-DD"),
    dayLabel: start.format("dddd, MMM D, YYYY"),
    startMinutes: start.hour() * 60 + start.minute(),
    endMinutes: end.hour() * 60 + end.minute() + (end.isAfter(start, "day") ? 24 * 60 : 0)
  };
}

export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
