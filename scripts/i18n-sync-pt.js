#!/usr/bin/env node
'use strict';

/*
 * i18n sync check: en.js is the source of truth for keys; pt.js must mirror it.
 *
 * Run after every upstream sync (see docs on the fork workflow) to find the
 * translation delta: keys that exist in English but not in Portuguese, keys
 * that became dead weight in Portuguese, and placeholder drift ({n}, {date},
 * HTML tags) between the two.
 *
 * Exit code 1 when anything needs attention, 0 when pt is in parity.
 */

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIR = path.join(__dirname, '..', 'frontend', 'js', 'i18n');

async function load(file) {
  const mod = await import(pathToFileURL(path.join(DIR, file)).href);
  return mod.default;
}

const placeholders = (s) => (String(s).match(/\{[A-Za-z0-9_]+\}/g) || []).sort().join(',');
const htmlTags = (s) => (String(s).match(/<\/?[A-Za-z][^>]*>/g) || []).sort().join('|');

async function main() {
  const en = await load('en.js');
  const pt = await load('pt.js');
  const enKeys = Object.keys(en);
  const ptKeys = new Set(Object.keys(pt));

  const missing = enKeys.filter((k) => !ptKeys.has(k));
  const extra = [...ptKeys].filter((k) => !(k in en));
  const drifted = enKeys.filter(
    (k) => k in pt && (placeholders(en[k]) !== placeholders(pt[k]) || htmlTags(en[k]) !== htmlTags(pt[k])),
  );

  if (missing.length) {
    console.log(`Missing in pt.js (${missing.length}) — translate these:`);
    for (const k of missing) console.log(`  '${k}': ${JSON.stringify(en[k])},`);
  }
  if (extra.length) {
    console.log(`Dead keys in pt.js, absent from en.js (${extra.length}):`);
    for (const k of extra) console.log(`  '${k}'`);
  }
  if (drifted.length) {
    console.log(`Placeholder/tag drift vs English (${drifted.length}):`);
    for (const k of drifted) console.log(`  '${k}'`);
  }
  if (!missing.length && !extra.length && !drifted.length) {
    console.log(`pt.js is in parity with en.js (${enKeys.length} keys). Nothing to do.`);
    process.exit(0);
  }
  const pct = (((enKeys.length - missing.length) / enKeys.length) * 100).toFixed(1);
  console.log(`Coverage: ${enKeys.length - missing.length}/${enKeys.length} (${pct}%)`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
