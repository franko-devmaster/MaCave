// Écrit src/build-info.ts avec la version du package, le commit et la date de build.
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const commit = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
const builtAt = new Date().toISOString();

const content = `// Généré par scripts/write-build-info.mjs — ne pas modifier.
export const BUILD_INFO = {
  version: '${version}',
  commit: '${commit}',
  builtAt: '${builtAt}',
} as const;
`;

writeFileSync(new URL('../src/build-info.ts', import.meta.url), content);
console.log(`build-info: ${version} ${commit} ${builtAt}`);
