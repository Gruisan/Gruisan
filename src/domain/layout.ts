// Géométrie du magasin, entièrement décrite par config/layout.json.
// Repère : x = longueur du bâtiment, z = largeur, y = hauteur ; origine au centre du sol.
// Un rayonnage a son origine au centre de son empreinte au sol ; son axe local x suit la longueur,
// sa face d'accès est du côté local +z ; rotation = rotation autour de y, en degrés.

import type { Emplacement } from './types';

export interface Batiment {
  longueur: number;
  largeur: number;
  hauteur: number;
  epaisseurMur: number;
}

export interface Porte {
  id: string;
  libelle: string;
  mur: 'nord' | 'sud' | 'est' | 'ouest';
  /** Position du centre le long du mur (x pour nord/sud, z pour est/ouest). */
  centre: number;
  largeur: number;
  hauteur: number;
}

export interface ZoneStockage {
  id: string;
  nom: string;
  couleur: string;
}

export type TypeAire = 'reception' | 'preparation' | 'sortie' | 'volumineux' | 'allee';

export interface Aire {
  id: string;
  nom: string;
  type: TypeAire;
  x: number;
  z: number;
  largeur: number;
  profondeur: number;
  couleur: string;
}

export interface Rayonnage {
  id: string;
  zone: string;
  x: number;
  z: number;
  rotation: number;
  longueur: number;
  profondeur: number;
  hauteur: number;
  niveaux: number;
  hauteurPremierNiveau: number;
  hauteurNiveau: number;
  emplacementsParNiveau: number;
  capaciteEmplacement: number;
}

export interface Layout {
  version: 1;
  nom: string;
  batiment: Batiment;
  portes: Porte[];
  zones: ZoneStockage[];
  aires: Aire[];
  rayonnages: Rayonnage[];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function emplacementId(zone: string, rayonnage: string, niveau: number, position: number): string {
  return `${zone}-${rayonnage}-N${pad2(niveau)}-E${pad2(position)}`;
}

/** Décompose A-A01-N02-E03. */
export function parseEmplacementId(id: string): { zone: string; rayonnage: string; niveau: number; position: number } | null {
  const m = /^([^-]+)-([^-]+)-N(\d+)-E(\d+)$/.exec(id);
  if (!m) return null;
  return { zone: m[1], rayonnage: m[2], niveau: Number(m[3]), position: Number(m[4]) };
}

/** Liste des emplacements déduite du layout (niveau 1 = le plus bas, position 1 = extrémité locale -x). */
export function emplacementsDepuisLayout(layout: Layout): Emplacement[] {
  const out: Emplacement[] = [];
  for (const r of layout.rayonnages) {
    for (let n = 1; n <= r.niveaux; n++) {
      for (let p = 1; p <= r.emplacementsParNiveau; p++) {
        out.push({
          EmplacementID: emplacementId(r.zone, r.id, n, p),
          Zone: r.zone,
          Rayonnage: r.id,
          Niveau: `N${pad2(n)}`,
          Position: `E${pad2(p)}`,
          Capacite: r.capaciteEmplacement,
        });
      }
    }
  }
  return out;
}

export interface SlotGeometry {
  emplacementId: string;
  rayonnageId: string;
  /** Centre du volume de l'emplacement, repère monde. */
  centre: [number, number, number];
  /** Taille du volume (local x, y, z). */
  taille: [number, number, number];
  /** Rotation y du rayonnage, radians. */
  rotationY: number;
  /** Normale de la face d'accès, repère monde. */
  normale: [number, number, number];
}

/** Transforme un point local du rayonnage en coordonnées monde. */
export function localVersMonde(r: Rayonnage, lx: number, ly: number, lz: number): [number, number, number] {
  const t = (r.rotation * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [r.x + lx * c + lz * s, ly, r.z - lx * s + lz * c];
}

export function normaleFace(r: Rayonnage): [number, number, number] {
  const t = (r.rotation * Math.PI) / 180;
  return [Math.sin(t), 0, Math.cos(t)];
}

/** Hauteur du plateau du niveau n (1-based). */
export function hauteurNiveau(r: Rayonnage, n: number): number {
  return r.hauteurPremierNiveau + (n - 1) * r.hauteurNiveau;
}

export function slotsDuRayonnage(r: Rayonnage): SlotGeometry[] {
  const out: SlotGeometry[] = [];
  const largeurSlot = r.longueur / r.emplacementsParNiveau;
  const hauteurSlot = Math.min(r.hauteurNiveau * 0.78, r.hauteurNiveau - 0.08);
  const rotationY = (r.rotation * Math.PI) / 180;
  for (let n = 1; n <= r.niveaux; n++) {
    const y = hauteurNiveau(r, n) + 0.04 + hauteurSlot / 2;
    for (let p = 1; p <= r.emplacementsParNiveau; p++) {
      const lx = -r.longueur / 2 + largeurSlot * (p - 0.5);
      out.push({
        emplacementId: emplacementId(r.zone, r.id, n, p),
        rayonnageId: r.id,
        centre: localVersMonde(r, lx, y, 0),
        taille: [largeurSlot * 0.86, hauteurSlot, r.profondeur * 0.82],
        rotationY,
        normale: normaleFace(r),
      });
    }
  }
  return out;
}

export function tousLesSlots(layout: Layout): SlotGeometry[] {
  return layout.rayonnages.flatMap(slotsDuRayonnage);
}
