import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const runtimeDir = path.join(rootDir, 'runtime', 'fingerprint-chromium');
const tag = process.env.FX_FINGERPRINT_CHROMIUM_TAG ?? '148.0.7778.215';
const fileName = process.env.FX_FINGERPRINT_CHROMIUM_ZIP ?? `ungoogled-chromium_${tag}-1.1_windows_x64.zip`;
const url = process.env.FX_FINGERPRINT_CHROMIUM_URL ?? `https://github.com/adryfish/fingerprint-chromium/releases/download/${tag}/${fileName}`;
const cacheDir = path.join(rootDir, '.cache');
const zipPath = path.join(cacheDir, fileName);
const expectedExe = path.join(runtimeDir, 'chrome.exe');

if (fs.existsSync(expectedExe)) {
  console.log(`fingerprint Chromium runtime already exists: ${expectedExe}`);
  process.exit(0);
}

fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(runtimeDir, { recursive: true });

if (!fs.existsSync(zipPath)) {
  console.log(`Downloading fingerprint Chromium ${tag}...`);
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Invoke-WebRequest -Uri '${url}' -OutFile '${zipPath}'`], { stdio: 'inherit' });
}

console.log(`Extracting ${zipPath} -> ${runtimeDir}`);
execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${runtimeDir}' -Force`], { stdio: 'inherit' });

function findChromeExe(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findChromeExe(full);
      if (found) return found;
    } else if (entry.name.toLowerCase() === 'chrome.exe') {
      return full;
    }
  }
  return null;
}

const foundExe = findChromeExe(runtimeDir);
if (!foundExe) throw new Error(`Downloaded runtime does not contain chrome.exe under ${runtimeDir}`);
if (foundExe !== expectedExe) {
  fs.cpSync(path.dirname(foundExe), runtimeDir, { recursive: true, force: true });
}
console.log(`fingerprint Chromium ready: ${expectedExe}`);
