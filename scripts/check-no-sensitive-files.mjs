import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbiddenNames = new Set([
  'export_profile.txt',
  'export_profile.xlsx',
]);
const forbiddenExtensions = ['.sqlite', '.sqlite3', '.db'];
const forbiddenDirs = new Set(['data', 'profiles', 'cookies', 'secrets', 'real-fixtures']);
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'dist-electron' || name === 'release') continue;
    const full = path.join(dir, name);
    const rel = path.relative(root, full).replaceAll('\\\\', '/');
    const st = statSync(full);

    if (st.isDirectory()) {
      if (forbiddenDirs.has(name)) problems.push(`Forbidden runtime/sensitive directory present: ${rel}`);
      walk(full);
      continue;
    }

    if (forbiddenNames.has(name)) problems.push(`Forbidden sensitive import file present: ${rel}`);
    if (forbiddenExtensions.some((ext) => name.endsWith(ext))) problems.push(`Forbidden database file present: ${rel}`);
    if (/import_report.*\.json$/i.test(name)) problems.push(`Forbidden real import report present: ${rel}`);
  }
}

walk(root);

if (existsSync(path.join(root, 'export_profile.txt'))) problems.push('Root export_profile.txt must not exist in repo');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

console.log('Security check passed: no obvious sensitive runtime/import files in repository.');
