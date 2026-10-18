// Textures de texte générées sur canvas (aucune police ni ressource externe).
import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

export interface OptionsTexte {
  couleur?: string;
  fond?: string | null;
  taille?: number;
  gras?: boolean;
  bordure?: string | null;
}

/** Retourne une texture et son ratio largeur/hauteur. */
export function textureTexte(texte: string, o: OptionsTexte = {}): { texture: THREE.CanvasTexture; ratio: number } {
  const cle = JSON.stringify([texte, o]);
  let t = cache.get(cle);
  if (!t) {
    const taille = o.taille ?? 64;
    const police = `${o.gras === false ? 500 : 700} ${taille}px "Segoe UI", Arial, sans-serif`;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    ctx.font = police;
    const marge = taille * 0.35;
    c.width = Math.ceil(ctx.measureText(texte).width + marge * 2);
    c.height = Math.ceil(taille * 1.35);
    ctx.font = police;
    if (o.fond) {
      ctx.fillStyle = o.fond;
      ctx.beginPath();
      ctx.roundRect(0, 0, c.width, c.height, taille * 0.18);
      ctx.fill();
    }
    if (o.bordure) {
      ctx.strokeStyle = o.bordure;
      ctx.lineWidth = taille * 0.08;
      ctx.beginPath();
      ctx.roundRect(ctx.lineWidth / 2, ctx.lineWidth / 2, c.width - ctx.lineWidth, c.height - ctx.lineWidth, taille * 0.18);
      ctx.stroke();
    }
    ctx.fillStyle = o.couleur ?? '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(texte, c.width / 2, c.height / 2 + taille * 0.04);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.userData.ratio = c.width / c.height;
    cache.set(cle, t);
  }
  return { texture: t, ratio: t.userData.ratio as number };
}

/** Texture de hachures (zones de signalisation au sol). */
export function textureHachures(couleur: string): THREE.CanvasTexture {
  const cle = `hachures:${couleur}`;
  let t = cache.get(cle);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = couleur;
    ctx.lineWidth = 14;
    for (let i = -64; i < 128; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 64);
      ctx.lineTo(i + 64, 0);
      ctx.stroke();
    }
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    cache.set(cle, t);
  }
  return t;
}
