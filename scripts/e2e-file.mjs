// Vérification de bout en bout du livrable dist/magasin3d.html, ouvert en file:// dans Chromium,
// réseau coupé, avec un profil persistant (fermeture / réouverture réelles du navigateur).
// Usage : node scripts/e2e-file.mjs   (CHROMIUM=/chemin/chrome pour changer d'exécutable)
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fichier = resolve('dist/magasin3d.html');
const url = pathToFileURL(fichier).href;
const profil = resolve('.e2e-profile');
const sorties = resolve(process.env.E2E_OUT ?? 'e2e-out');
rmSync(profil, { recursive: true, force: true });
mkdirSync(sorties, { recursive: true });

const demo = JSON.parse(readFileSync('src/data/demo-data.json', 'utf8'));
const parArticle = new Map();
for (const s of demo.stocks) parArticle.set(s.ArticleID, [...(parArticle.get(s.ArticleID) ?? []), s]);
const [artMulti, stocksMulti] = [...parArticle].find(([, l]) => l.length === 2);
const refMulti = demo.articles.find((a) => a.ArticleID === artMulti).Reference;

const resultats = [];
const verifier = (nom, ok, detail = '') => {
  resultats.push({ nom, ok, detail });
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`);
};

async function ouvrir(viewport = { width: 1366, height: 768 }) {
  const ctx = await chromium.launchPersistentContext(profil, {
    executablePath: exe,
    headless: true,
    offline: true,
    viewport,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const requetes = [];
  const erreurs = [];
  page.on('request', (r) => {
    if (!/^(file|data|blob):/.test(r.url())) requetes.push(r.url());
  });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()));
  await page.goto(url);
  await page.waitForSelector('[data-testid="etat-donnees"]', { timeout: 20000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  return { ctx, page, requetes, erreurs };
}

const nbMouvementsAffiches = async (page) => {
  await page.click('nav >> text=Historique');
  const t = await page.textContent('[data-testid="page-historique"] >> text=/mouvement\\(s\\)/');
  return Number(t.replace(/\D/g, ''));
};

// ---------- Session 1 ----------
let { ctx, page, requetes, erreurs } = await ouvrir();
const etat = await page.textContent('[data-testid="etat-donnees"]');
verifier('Persistance détectée en file://', /IndexedDB/.test(etat), etat.trim());
verifier('Origine de la page', true, await page.evaluate(() => `${location.protocol} — secure context : ${isSecureContext}`));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${sorties}/1-vue-ensemble-1366.png` });

// Recherche d'une référence présente à 2 emplacements.
await page.fill('[data-testid="recherche"]', refMulti);
await page.waitForSelector('[data-testid="resultats"]');
const boutons = page.locator('[data-testid="resultats"] >> [data-testid="resultat-emplacement"]');
const nbBoutons = await boutons.count();
const libelles = await boutons.allTextContents();
const attendus = stocksMulti.map((s) => s.EmplacementID).sort();
verifier(`Recherche ${refMulti} : 2 emplacements listés`, nbBoutons === 2 && attendus.every((e) => libelles.some((l) => l.includes(e))), libelles.join(' | '));
await page.screenshot({ path: `${sorties}/2-recherche.png` });
const cible = attendus[1];
await boutons.filter({ hasText: cible }).click();
await page.waitForTimeout(2500); // fin de l'animation caméra
const empSel = await page.textContent('[data-testid="emplacement-id"]');
verifier('Clic résultat → emplacement sélectionné', empSel.trim() === cible, empSel.trim());
const cam = await page.evaluate(() => {
  const c = window.__magasinCamera;
  const t = c.getTarget({ x: 0, y: 0, z: 0, copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; } });
  return { x: t.x, y: t.y, z: t.z };
});
const layout = JSON.parse(readFileSync('config/layout.json', 'utf8'));
const [, rid, niv, pos] = /^[^-]+-([^-]+)-N(\d+)-E(\d+)$/.exec(cible);
const r = layout.rayonnages.find((x) => x.id === rid);
const t = (r.rotation * Math.PI) / 180;
const lx = -r.longueur / 2 + (r.longueur / r.emplacementsParNiveau) * (Number(pos) - 0.5);
const hs = Math.min(r.hauteurNiveau * 0.78, r.hauteurNiveau - 0.08);
const attendu = { x: r.x + lx * Math.cos(t), y: r.hauteurPremierNiveau + (Number(niv) - 1) * r.hauteurNiveau + 0.04 + hs / 2, z: r.z - lx * Math.sin(t) };
const ecart = Math.hypot(cam.x - attendu.x, cam.y - attendu.y, cam.z - attendu.z);
verifier('Caméra cadrée sur le bon emplacement', ecart < 0.05, `cible caméra (${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.z.toFixed(2)}), écart ${ecart.toFixed(3)} m`);
const loc = await page.textContent('[data-testid="localisation"]');
verifier('Panneau : les 2 emplacements de la référence', attendus.every((e) => loc.includes(e)), loc.trim());
await page.screenshot({ path: `${sorties}/3-localisation.png` });

// Sortie excessive refusée.
const qteCible = stocksMulti.find((s) => s.EmplacementID === cible).Quantite;
const avant = await nbMouvementsAffiches(page);
await page.click('nav >> text=Magasin 3D');
await page.click('[data-testid="liste-references"] li:has-text("' + refMulti + '")');
await page.click('[data-testid="btn-sortie"]');
await page.fill('[data-testid="champ-quantite"]', String(qteCible + 5));
await page.click('[data-testid="btn-valider"]');
const err = await page.textContent('[data-testid="erreur-mouvement"]');
verifier('Sortie excessive refusée avec message', /refusé/.test(err), err.trim());
await page.screenshot({ path: `${sorties}/4-sortie-refusee.png` });
// Sortie valide.
await page.fill('[data-testid="champ-quantite"]', '1');
await page.click('[data-testid="btn-valider"]');
await page.waitForSelector('[data-testid="formulaire-mouvement"]', { state: 'detached' });
// Départ stand-by depuis le panneau.
await page.click('[data-testid="btn-standby"]');
await page.fill('[data-testid="champ-quantite"]', '1');
await page.fill('[data-testid="champ-chantier"]', 'Chantier E2E');
await page.click('[data-testid="btn-valider"]');
await page.waitForSelector('[data-testid="formulaire-mouvement"]', { state: 'detached' });
const apres = await nbMouvementsAffiches(page);
verifier('Mouvements historisés', apres === avant + 2, `${avant} → ${apres}`);
const bandeau = await page.textContent('[data-testid="barre-evenements"]');
verifier('Bandeau d’événements mis à jour', /Stand-by/.test(bandeau), bandeau.trim().slice(0, 140));
await page.click('nav >> text=Tableau de bord');
await page.waitForSelector('[data-testid="kpi-standby"]');
const kpiSb = await page.textContent('[data-testid="kpi-standby"]');
await page.screenshot({ path: `${sorties}/5-tableau-de-bord.png` });

// Mesure FPS (vue d'ensemble, caméra en rotation continue).
await page.click('nav >> text=Magasin 3D');
await page.click('[data-testid="vue-orbite"]');
await page.keyboard.press('Escape');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.__rot = setInterval(() => window.__magasinCamera.rotate(0.01, 0, false), 16);
});
const fps = [];
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(1000);
  fps.push(await page.evaluate(() => window.__magasinFps));
}
await page.evaluate(() => clearInterval(window.__rot));
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'inconnu';
});
console.log(`FPS mesurés (1366×768, rotation continue) : ${fps.join(', ')} — rendu : ${gpu}`);
verifier('Aucune requête réseau', requetes.length === 0, requetes.slice(0, 5).join(', '));
verifier('Aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
await ctx.close();

// ---------- Session 2 : réouverture ----------
({ ctx, page, requetes, erreurs } = await ouvrir({ width: 1920, height: 1080 }));
const reouvert = await nbMouvementsAffiches(page);
verifier('Après fermeture/réouverture : mouvements conservés', reouvert === apres, `${reouvert} mouvements`);
await page.click('nav >> text=Tableau de bord');
const kpiSb2 = await page.textContent('[data-testid="kpi-standby"]');
verifier('Après réouverture : stand-by conservé', kpiSb2 === kpiSb, kpiSb2);
await page.screenshot({ path: `${sorties}/6-tableau-de-bord-1920.png` });
await page.click('nav >> text=Stand-by');
await page.waitForSelector('text=Chantier E2E');
await page.screenshot({ path: `${sorties}/7-standby-1920.png` });
await page.click('nav >> text=Magasin 3D');
await page.click('[data-testid="vue-dessus"]');
await page.waitForTimeout(1800);
await page.screenshot({ path: `${sorties}/8-vue-dessus-1920.png` });
await page.click('[data-testid="vue-iso"]');
await page.waitForTimeout(1800);
await page.screenshot({ path: `${sorties}/9-vue-iso-1920.png` });
const fps2 = [];
await page.evaluate(() => {
  window.__rot = setInterval(() => window.__magasinCamera.rotate(0.01, 0, false), 16);
});
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(1000);
  fps2.push(await page.evaluate(() => window.__magasinFps));
}
console.log(`FPS mesurés (1920×1080, vue iso, rotation continue) : ${fps2.join(', ')}`);
verifier('Session 2 : aucune requête réseau', requetes.length === 0, requetes.slice(0, 5).join(', '));
verifier('Session 2 : aucune erreur JavaScript', erreurs.length === 0, erreurs.slice(0, 3).join(' | '));
await ctx.close();
rmSync(profil, { recursive: true, force: true });

const echecs = resultats.filter((r) => !r.ok);
console.log(`\n${resultats.length - echecs.length}/${resultats.length} vérifications OK. Captures : ${sorties}`);
process.exit(echecs.length ? 1 : 0);
