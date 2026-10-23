// Génère data/INVENTAIRE_MAGASIN_DEMO.xlsx (jeu de démo, mapping par défaut).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import mapping from '../config/import-mapping.json';
import demo from '../src/data/demo-data.json';
import { classeurVersOctets, exporterClasseur, validerMapping } from '../src/domain/excel';
import type { Snapshot } from '../src/domain/types';

const s = demo as Snapshot;
const derniere = s.mouvements.reduce((d, m) => (m.DateHeure > d ? m.DateHeure : d), '');
const dir = resolve(import.meta.dirname ?? '.', '../data');
mkdirSync(dir, { recursive: true });
const out = resolve(dir, 'INVENTAIRE_MAGASIN_DEMO.xlsx');
writeFileSync(out, classeurVersOctets(exporterClasseur(s, validerMapping(mapping), new Date(derniere))));
console.log(`${out} : ${s.articles.length} articles, ${s.emplacements.length} emplacements, ${s.stocks.length} stocks, ${s.mouvements.length} mouvements, ${s.standbys.length} stand-by.`);
