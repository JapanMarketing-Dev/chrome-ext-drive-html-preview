// Packages src/ into dist/drive-html-preview-<version>.zip for the Chrome Web Store.
import { readFile, rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const manifest = JSON.parse(await readFile(join(src, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  throw new Error(`manifest.json version ${manifest.version} != package.json version ${pkg.version}`);
}

const out = join(root, 'dist', `drive-html-preview-${manifest.version}.zip`);
await mkdir(dirname(out), { recursive: true });
await rm(out, { force: true });
// package.json in src/ only marks the scripts as CommonJS for the tests.
execFileSync('zip', ['-r', '-X', '-q', out, '.', '-x', 'package.json', '-x', '.*', '-x', '*/.*'], { cwd: src, stdio: 'inherit' });
console.log('built', out.replace(root + '/', ''));
