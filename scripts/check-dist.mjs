// Vérifie que le livrable est bien un fichier unique sans dépendance externe.
import { readdirSync, readFileSync, statSync } from 'node:fs';

const fichiers = readdirSync('dist');
const html = readFileSync('dist/magasin3d.html', 'utf8');
const problemes = [];
if (fichiers.length !== 1) problemes.push(`dist/ contient ${fichiers.length} fichiers : ${fichiers.join(', ')}`);
if (/<script[^>]+src=/i.test(html)) problemes.push('balise <script src> présente');
if (/<link[^>]+rel=["']?stylesheet[^>]+href=/i.test(html)) problemes.push('feuille de style externe');
if (/navigator\.serviceWorker\.register/.test(html)) problemes.push('service worker');
if (/new\s+Worker\(\s*["'][^"']+\.js/.test(html)) problemes.push('Web Worker en fichier séparé');
if (/\bimport\(\s*["'`]\.{0,2}\//.test(html)) problemes.push('import dynamique de module relatif');
const urls = [...html.matchAll(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)]*/gi)].map((m) => m[0]);
const hotes = [...new Set(urls.map((u) => new URL(u).host))].sort();
console.log(`dist/magasin3d.html : ${(statSync('dist/magasin3d.html').size / 1024 / 1024).toFixed(2)} Mo`);
console.log(`Hôtes cités dans le code (chaînes, non chargés automatiquement — vérifié en e2e réseau coupé) : ${hotes.join(', ') || 'aucun'}`);
if (problemes.length) {
  console.error('ÉCHEC du contrôle du livrable :\n - ' + problemes.join('\n - '));
  process.exit(1);
}
console.log('Contrôle du livrable : OK (fichier unique, pas de script/style externe, pas de worker fichier, pas de service worker).');
