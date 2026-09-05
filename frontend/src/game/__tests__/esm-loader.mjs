// Minimal ESM resolver loader (test-only, not part of the app bundle): lets
// plain `node` run the extension-less imports used throughout src/ (Metro
// resolves these automatically; Node's ESM loader needs an explicit hook).
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && context.parentURL) {
      const base = fileURLToPath(new URL(specifier, context.parentURL));
      for (const ext of ['.js', '.mjs']) {
        if (existsSync(base + ext)) {
          return nextResolve(specifier + ext, context);
        }
      }
    }
    throw err;
  }
}
