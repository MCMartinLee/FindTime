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

export function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
