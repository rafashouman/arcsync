export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getPartsFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) {
    return false;
  }
  try {
    getPartsFormatter(value);
    return true;
  } catch {
    return false;
  }
}

export function getZonedDateTimeParts(
  value: Date | string,
  timeZone: string,
): ZonedDateTimeParts {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()) || !isValidTimeZone(timeZone)) {
    throw new Error('Data ou fuso horário inválido.');
  }

  const values = getPartsFormatter(timeZone).formatToParts(date);
  const parts = Object.fromEntries(
    values
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function getOffsetAt(timestamp: number, timeZone: string) {
  const parts = getZonedDateTimeParts(new Date(timestamp), timeZone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return zonedAsUtc - Math.floor(timestamp / 1000) * 1000;
}

export function zonedDateTimeToIso(
  dateValue: string,
  timeValue: string,
  timeZone: string,
): string | null {
  if (!isValidTimeZone(timeZone)) return null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const wallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const calendarCheck = new Date(wallTimeAsUtc);
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() + 1 !== month ||
    calendarCheck.getUTCDate() !== day
  ) {
    return null;
  }

  const offsets = new Set<number>();
  const sampleWindow = 48 * 60 * 60 * 1000;
  const sampleInterval = 2 * 60 * 60 * 1000;
  for (
    let sample = wallTimeAsUtc - sampleWindow;
    sample <= wallTimeAsUtc + sampleWindow;
    sample += sampleInterval
  ) {
    offsets.add(getOffsetAt(sample, timeZone));
  }

  const candidates = [...offsets]
    .map((offset) => wallTimeAsUtc - offset)
    .filter((candidate) => {
      const parts = getZonedDateTimeParts(new Date(candidate), timeZone);
      return (
        parts.year === year &&
        parts.month === month &&
        parts.day === day &&
        parts.hour === hour &&
        parts.minute === minute &&
        parts.second === 0
      );
    })
    .sort((a, b) => a - b);

  return candidates.length ? new Date(candidates[0]).toISOString() : null;
}

export function getDateTimeInputValues(value: Date | string, timeZone: string) {
  const parts = getZonedDateTimeParts(value, timeZone);
  return {
    date: `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
    time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`,
  };
}

export function rescheduleIsoToCalendarDay(
  currentIso: string,
  targetDate: string,
  timeZone: string,
) {
  const { time } = getDateTimeInputValues(currentIso, timeZone);
  return zonedDateTimeToIso(targetDate, time, timeZone);
}

export function formatZonedTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatZonedDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}
