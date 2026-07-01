import { useMemo } from "react";
import { formatUtcRangeForTimezone, slotBoundsForTimezone } from "../utils/time";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function AvailabilityCalendar({ rows, durationMinutes, timezone, emptyMessage = "" }) {
  const days = useMemo(() => {
    const rowsWithBounds = rows
      .map((row) => ({
        ...row,
        bounds: slotBoundsForTimezone(row.slot.startUtc, durationMinutes, timezone)
      }))
      .filter((row) => row.bounds);

    const grouped = new Map();
    for (const row of rowsWithBounds) {
      const existing = grouped.get(row.bounds.dayKey) || {
        dayKey: row.bounds.dayKey,
        dayLabel: row.bounds.dayLabel,
        rows: []
      };
      existing.rows.push(row);
      grouped.set(row.bounds.dayKey, existing);
    }

    return Array.from(grouped.values())
      .map((day) => {
        const sortedRows = [...day.rows].sort(
          (a, b) => a.bounds.startMinutes - b.bounds.startMinutes
        );
        const placedRows = [];
        for (const row of sortedRows) {
          const overlappingRows = sortedRows.filter(
            (candidate) =>
              candidate.bounds.startMinutes < row.bounds.endMinutes &&
              candidate.bounds.endMinutes > row.bounds.startMinutes
          );
          const usedColumns = placedRows
            .filter((candidate) => candidate.bounds.endMinutes > row.bounds.startMinutes)
            .map((candidate) => candidate.columnIndex);
          let columnIndex = 0;
          while (usedColumns.includes(columnIndex)) columnIndex += 1;

          placedRows.push({
            ...row,
            columnIndex,
            columnCount: Math.max(1, overlappingRows.length)
          });
        }
        const minStart = Math.min(...placedRows.map((row) => row.bounds.startMinutes));
        const maxEnd = Math.max(...placedRows.map((row) => row.bounds.endMinutes));
        const startHour = Math.floor(minStart / 60);
        const endHour = Math.ceil(maxEnd / 60);

        return {
          ...day,
          rows: placedRows,
          startHour,
          endHour,
          totalMinutes: Math.max(60, (endHour - startHour) * 60)
        };
      })
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [rows, durationMinutes, timezone]);

  if (days.length === 0) {
    return emptyMessage ? <p className="muted">{emptyMessage}</p> : null;
  }

  const maxVotes = Math.max(1, ...rows.map((row) => row.count || 0));

  return (
    <div className="calendar-list">
      {days.map((day) => (
        <section key={day.dayKey} className="calendar-day">
          <h3>{day.dayLabel}</h3>
          <div
            className="calendar-grid"
            style={{
              gridTemplateRows: `repeat(${day.endHour - day.startHour}, minmax(42px, 1fr))`
            }}
          >
            <div className="calendar-axis">
              {Array.from({ length: day.endHour - day.startHour }, (_, index) => (
                <span key={index}>{`${day.startHour + index}:00`}</span>
              ))}
            </div>
            <div className="calendar-track">
              {Array.from({ length: day.endHour - day.startHour }, (_, index) => (
                <div key={index} className="calendar-hour-line" />
              ))}
              {day.rows.map((row) => {
                const top =
                  ((row.bounds.startMinutes - day.startHour * 60) / day.totalMinutes) * 100;
                const height =
                  ((row.bounds.endMinutes - row.bounds.startMinutes) / day.totalMinutes) * 100;
                const strength = (row.count || 0) / maxVotes;
                const opacity = clamp(0.32 + strength * 0.52, 0.32, 0.84);
                const scale = clamp(1 + strength * 0.04, 1, 1.04);
                const width = 100 / row.columnCount;

                return (
                  <div
                    key={row.slot.id}
                    className="calendar-event"
                    style={{
                      top: `${top}%`,
                      height: `${height}%`,
                      left: `calc(${row.columnIndex * width}% + 0.45rem)`,
                      right: "auto",
                      width: `calc(${width}% - 0.7rem)`,
                      opacity,
                      transform: `scaleX(${scale})`
                    }}
                  >
                    <strong>
                      {formatUtcRangeForTimezone(row.slot.startUtc, durationMinutes, timezone)}
                    </strong>
                    <span>
                      {row.count || 0} vote{row.count === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

export default AvailabilityCalendar;
