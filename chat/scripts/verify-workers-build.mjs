#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const requiredRoutes = ['/rooms/amlc1bekzi', '/auth/callback', '/settings'];
const tokenPattern = /(secret-token|token=secret|"token":"secret|[?&]i=secret)/i;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

const indexPath = join(distDir, 'index.html');
if (!await exists(indexPath)) {
  throw new Error('dist/index.html is missing. Run npm run build first.');
}

const files = await listFiles(distDir);
if (!files.some((file) => /assets\/.+\.(js|css)$/.test(file))) {
  throw new Error('dist assets are missing.');
}

for (const file of files) {
  const content = await readFile(file, 'utf8').catch(() => '');
  if (tokenPattern.test(content)) {
    throw new Error(`token-like fixture leaked into build output: ${file}`);
  }
}

for (const route of requiredRoutes) {
  if (!route.startsWith('/')) {
    throw new Error(`invalid app route: ${route}`);
  }
}

process.stdout.write('Workers build verification passed\n');
