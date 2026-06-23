#!/usr/bin/env node
/**
 * Segunda pasada del rename: arregla acuerdo de género tras el primer rename.
 * "curso" (masculino) → "publicación" (femenino) y "academia" (femenino) →
 * "sitio" (masculino) dejan combinaciones rotas como "nuevo publicación" o
 * "la sitio". Esto las normaliza.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/app', 'src/components'];
const EXTS = ['.tsx', '.ts', '.jsx', '.js'];

// Cada par [regex, reemplazo]. ¡Orden importa! Los compuestos largos primero.
const REPLACEMENTS = [
  // ─── publicación (femenino) — modificadores masculinos sueltos ───
  // Compuestos primero
  [/\btodos los publicaciones\b/g, 'todas las publicaciones'],
  [/\bTodos los publicaciones\b/g, 'Todas las publicaciones'],
  [/\balgunos publicaciones\b/g, 'algunas publicaciones'],
  [/\bAlgunos publicaciones\b/g, 'Algunas publicaciones'],
  [/\bmuchos publicaciones\b/g, 'muchas publicaciones'],
  [/\bMuchos publicaciones\b/g, 'Muchas publicaciones'],
  [/\bpocos publicaciones\b/g, 'pocas publicaciones'],
  [/\bnuestros publicaciones\b/g, 'nuestras publicaciones'],
  [/\bNuestros publicaciones\b/g, 'Nuestras publicaciones'],
  [/\bestos publicaciones\b/g, 'estas publicaciones'],
  [/\bEstos publicaciones\b/g, 'Estas publicaciones'],
  [/\besos publicaciones\b/g, 'esas publicaciones'],
  [/\bEsos publicaciones\b/g, 'Esas publicaciones'],
  [/\bvarios publicaciones\b/g, 'varias publicaciones'],
  [/\bcuántos publicaciones\b/g, 'cuántas publicaciones'],
  [/\btantos publicaciones\b/g, 'tantas publicaciones'],
  [/\bunos publicaciones\b/g, 'unas publicaciones'],
  // Singulares
  [/\bnuevo publicación\b/g, 'nueva publicación'],
  [/\bNuevo publicación\b/g, 'Nueva publicación'],
  [/\bnuevo Publicación\b/g, 'nueva Publicación'],
  [/\bNuevo Publicación\b/g, 'Nueva Publicación'],
  [/\bel publicación\b/g, 'la publicación'],
  [/\bEl publicación\b/g, 'La publicación'],
  [/\bdel publicación\b/g, 'de la publicación'],
  [/\bDel publicación\b/g, 'De la publicación'],
  [/\bun publicación\b/g, 'una publicación'],
  [/\bUn publicación\b/g, 'Una publicación'],
  [/\beste publicación\b/g, 'esta publicación'],
  [/\bEste publicación\b/g, 'Esta publicación'],
  [/\bese publicación\b/g, 'esa publicación'],
  [/\bEse publicación\b/g, 'Esa publicación'],
  [/\bprimer publicación\b/g, 'primera publicación'],
  [/\bPrimer publicación\b/g, 'Primera publicación'],
  [/\bnuestro publicación\b/g, 'nuestra publicación'],
  [/\bNuestro publicación\b/g, 'Nuestra publicación'],
  [/\botro publicación\b/g, 'otra publicación'],
  [/\bOtro publicación\b/g, 'Otra publicación'],
  [/\bningún publicación\b/g, 'ninguna publicación'],
  [/\balgún publicación\b/g, 'alguna publicación'],
  [/\btodo publicación\b/g, 'toda publicación'],
  [/\bcada publicación\b/g, 'cada publicación'], // (no-op, ya correcto)
  [/\bcuánto publicación\b/g, 'cuánta publicación'],
  [/\btanto publicación\b/g, 'tanta publicación'],

  // Adjetivos masculinos pegados a "publicación" (heredados del rename)
  [/\bonline ?publicación\b/g, 'publicación online'], // safety, casi nunca
  [/\bdel publicación\b/g, 'de la publicación'],
  [/\b(publicación) (online|nuevo|propio|listo)\b/gi, (_, n, a) => {
    const map = { online: 'online', nuevo: 'nueva', propio: 'propia', listo: 'lista' };
    return `${n} ${map[a.toLowerCase()] ?? a}`;
  }],

  // ─── sitio (masculino) — modificadores femeninos sueltos ───
  // Compuestos primero
  [/\btodas las sitios\b/g, 'todos los sitios'],
  [/\bTodas las sitios\b/g, 'Todos los sitios'],
  [/\balgunas sitios\b/g, 'algunos sitios'],
  [/\bAlgunas sitios\b/g, 'Algunos sitios'],
  [/\bmuchas sitios\b/g, 'muchos sitios'],
  [/\bMuchas sitios\b/g, 'Muchos sitios'],
  [/\bpocas sitios\b/g, 'pocos sitios'],
  [/\bnuestras sitios\b/g, 'nuestros sitios'],
  [/\bNuestras sitios\b/g, 'Nuestros sitios'],
  [/\bestas sitios\b/g, 'estos sitios'],
  [/\bEstas sitios\b/g, 'Estos sitios'],
  [/\besas sitios\b/g, 'esos sitios'],
  [/\bEsas sitios\b/g, 'Esos sitios'],
  [/\bvarias sitios\b/g, 'varios sitios'],
  [/\bcuántas sitios\b/g, 'cuántos sitios'],
  [/\btantas sitios\b/g, 'tantos sitios'],
  [/\bunas sitios\b/g, 'unos sitios'],
  [/\blas sitios\b/g, 'los sitios'],
  [/\bLas sitios\b/g, 'Los sitios'],
  // Singulares
  [/\bnueva sitio\b/g, 'nuevo sitio'],
  [/\bNueva sitio\b/g, 'Nuevo sitio'],
  [/\bla sitio\b/g, 'el sitio'],
  [/\bLa sitio\b/g, 'El sitio'],
  [/\bde la sitio\b/g, 'del sitio'],
  [/\bDe la sitio\b/g, 'Del sitio'],
  [/\buna sitio\b/g, 'un sitio'],
  [/\bUna sitio\b/g, 'Un sitio'],
  [/\besta sitio\b/g, 'este sitio'],
  [/\bEsta sitio\b/g, 'Este sitio'],
  [/\besa sitio\b/g, 'ese sitio'],
  [/\bEsa sitio\b/g, 'Ese sitio'],
  [/\bprimera sitio\b/g, 'primer sitio'],
  [/\bPrimera sitio\b/g, 'Primer sitio'],
  [/\bnuestra sitio\b/g, 'nuestro sitio'],
  [/\bNuestra sitio\b/g, 'Nuestro sitio'],
  [/\botra sitio\b/g, 'otro sitio'],
  [/\bOtra sitio\b/g, 'Otro sitio'],
  [/\bninguna sitio\b/g, 'ningún sitio'],
  [/\balguna sitio\b/g, 'algún sitio'],
  [/\btoda sitio\b/g, 'todo sitio'],
  [/\bcuánta sitio\b/g, 'cuánto sitio'],
  [/\btanta sitio\b/g, 'tanto sitio'],
  // Adjetivos femeninos pegados a "sitio"
  [/\b(sitio) (nueva|propia|lista|funcional|publicada)\b/gi, (_, n, a) => {
    const map = { nueva: 'nuevo', propia: 'propio', lista: 'listo', funcional: 'funcional', publicada: 'publicado' };
    return `${n} ${map[a.toLowerCase()] ?? a}`;
  }],
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
      content = typeof to === 'function' ? content.replace(re, to) : content.replace(re, to);
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

console.log('Fixing gender agreement post-rename...\n');
for (const root of ROOTS) walk(root, processFile);
console.log(`\nDone. ${filesChanged} files, ${totalReplacements} replacements.`);
