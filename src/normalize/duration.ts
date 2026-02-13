export function parseIso8601DurationToMinutes(duration: string): number | null {
  const s = duration.trim();
  if (!s) return null;

  const match = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return null;

  const days = match[1] ? Number.parseInt(match[1], 10) : 0;
  const hours = match[2] ? Number.parseInt(match[2], 10) : 0;
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  const seconds = match[4] ? Number.parseInt(match[4], 10) : 0;

  if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) return null;

  const totalMinutes = days * 24 * 60 + hours * 60 + minutes;
  if (seconds === 0) return totalMinutes;
  return totalMinutes + Math.ceil(seconds / 60);
}
