export function formatDuration(milliseconds) {
  if (milliseconds == null) return 'Live';

  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const paddedSeconds = String(seconds).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}

export function parseTimestamp(value) {
  const input = value.trim();

  if (/^\d+$/.test(input)) return Number(input) * 1000;

  const parts = input.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((part) => !/^\d+$/.test(part))) return null;

  const numbers = parts.map(Number);

  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    if (seconds >= 60) return null;
    return (minutes * 60 + seconds) * 1000;
  }

  const [hours, minutes, seconds] = numbers;
  if (minutes >= 60 || seconds >= 60) return null;
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

export function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
