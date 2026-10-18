// Mesure des images/s de la vue d'ensemble (caméra en rotation continue).
// Usage : node scripts/mesure-fps.mjs [url]   — par défaut dist/magasin3d.html en file://.
// Pour une mesure en dev avec stats.js : lancer `npm run dev` puis passer http://localhost:5173/magasin3d.html.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? pathToFileURL(resolve('dist/magasin3d.html')).href;
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const navigateur = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  for (const qualite of ['haute', 'eco']) {
    const ctx = await navigateur.newContext({ viewport });
    await ctx.addInitScript((q) => {
      localStorage.setItem('magasin3d:pref:qualite', JSON.stringify(q));
      localStorage.setItem('magasin3d:pref:fps', 'true'); // panneau stats.js visible
    }, qualite);
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForSelector('canvas');
    await page.waitForTimeout(2500);
    const statsJs = await page.evaluate(() => document.querySelectorAll('canvas').length > 1);
    await page.evaluate(() => (window.__rot = setInterval(() => window.__magasinCamera.rotate(0.01, 0, false), 16)));
    const fps = [];
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1000);
      fps.push(await page.evaluate(() => window.__magasinFps));
    }
    const rendu = await page.evaluate(() => window.__magasinRendu());
    const tri = [...fps].sort((a, b) => a - b);
    console.log(
      `${viewport.width}×${viewport.height} qualité=${qualite} : FPS ${fps.join(' ')} → médiane ${tri[4]} | ${rendu.appels} draw calls, ${rendu.triangles} triangles, canvas ${rendu.largeur}×${rendu.hauteur} (dpr ${rendu.dpr}) | stats.js ${statsJs ? 'présent' : 'absent'}`,
    );
    await ctx.close();
  }
}
const p = await navigateur.newPage();
console.log(
  'Rendu WebGL : ' +
    (await p.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);
    })),
);
console.log(`Processeurs logiques : ${await p.evaluate(() => navigator.hardwareConcurrency)}`);
await navigateur.close();
