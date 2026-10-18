// Génère src/data/demo-data.json à partir de config/layout.json (seed fixe → résultat identique à chaque exécution).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import layout from '../config/layout.json';
import { genererDemo } from '../src/domain/demoGenerator';
import type { Layout } from '../src/domain/layout';

const s = genererDemo(layout as Layout);
const out = resolve(import.meta.dirname ?? '.', '../src/data/demo-data.json');
writeFileSync(out, JSON.stringify(s, null, 1) + '\n');
console.log(
  `demo-data.json : ${s.articles.length} articles, ${s.emplacements.length} emplacements, ${s.stocks.length} lignes de stock, ` +
    `${s.mouvements.length} mouvements, ${s.standbys.length} stand-by.`,
);
