export class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export function describeError(error) {
  if (error instanceof UserFacingError) return error.message;

  const raw = error?.stderr || error?.message || String(error);
  const lines = String(raw)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (lines.at(-1) ?? 'Unknown error').slice(0, 300);
}
