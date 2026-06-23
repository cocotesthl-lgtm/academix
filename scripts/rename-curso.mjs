#!/usr/bin/env node
/**
 * Rename masivo: "curso" → "publicación" y "academia" → "sitio" en strings
 * visibles. Solo toca palabras españolas con word boundaries — código en
 * inglés (Course, course_id, /courses) queda intacto.
 *
 * Scope: src/app/ + src/components/ (no toca src/lib/ ni src/db/).
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/app', 'src/components'];
const EXTS = ['.tsx', '.ts', '.jsx', '.js'];

// Orden importa: primero plurales/compuestos, después singulares
const REPLACEMENTS = [
  // Plurales primero
  [/\bCursos\b/g, 'Publicaciones'],
  [/\bcursos\b/g, 'publicaciones'],
  // Singulares
  [/\bCurso\b/g, 'Publicación'],
  [/\bcurso\b/g, 'publicación'],
  // Academia
  [/\bAcademias\b/g, 'Sitios'],
  [/\bacademias\b/g, 'sitios'],
  [/\bAcademia\b/g, 'Sitio'],
  [/\bacademia\b/g, 'sitio']
];

let filesChanged = 0;
let totalReplacements = 0;

function walk(dir, callback) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, callback);
    else if (EXTS.some((e) => entry.endsWith(e))) callback(full);
  }
}

function processFile(path) {
  let content = readFileSync(path, 'utf8');
  let changed = false;
  let countInFile = 0;
  for (const [re, to] of REPLACEMENTS) {
    const matches = content.match(re);
    if (matches) {
      countInFile += matches.length;
      content = content.replace(re, to);
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(path, content, 'utf8');
    filesChanged++;
    totalReplacements += countInFile;
    console.log(`  ${path} (${countInFile})`);
  }
}

console.log('Renaming "curso" → "publicación", "academia" → "sitio"...\n');
for (const root of ROOTS) walk(root, processFile);
console.log(`\nDone. ${filesChanged} files, ${totalReplacements} replacements.`);
