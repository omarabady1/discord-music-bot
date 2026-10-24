const stamp = () => new Date().toISOString();

export function log(...args) {
  console.log(`[${stamp()}]`, ...args);
}

export function logError(...args) {
  console.error(`[${stamp()}]`, ...args);
}
