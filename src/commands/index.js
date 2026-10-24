import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const IGNORED_FILES = new Set(['index.js', 'shared.js']);

export async function loadCommands() {
  const directory = fileURLToPath(new URL('.', import.meta.url));
  const files = (await readdir(directory)).filter(
    (file) => file.endsWith('.js') && !IGNORED_FILES.has(file),
  );

  const commands = new Map();

  for (const file of files) {
    const module = await import(
      pathToFileURL(path.join(directory, file)).href
    );

    if (!module.data || typeof module.execute !== 'function') {
      continue;
    }

    commands.set(module.data.name, module);
  }

  return commands;
}
