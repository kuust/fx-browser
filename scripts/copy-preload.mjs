import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const source = path.join(projectRoot, 'src/main/preload.cjs');
const targetDir = path.join(projectRoot, 'dist-electron/main');
const target = path.join(targetDir, 'preload.cjs');

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log(`Copied ${path.relative(projectRoot, source)} -> ${path.relative(projectRoot, target)}`);
