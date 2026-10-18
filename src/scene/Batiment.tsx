// Sol, murs, porte, aires de travail et signalisation au sol — tout vient du layout.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Aire, Layout, Porte } from '../domain/layout';
import { textureHachures, textureTexte } from './textures';

export function Batiment({ layout }: { layout: Layout }) {
  const { longueur: L, largeur: W, hauteur: H, epaisseurMur: ep } = layout.batiment;
  const murs = useMemo(() => construireMurs(layout), [layout]);
  return (
    <group>
      {/* Dalle béton */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[L, W]} />
        <meshLambertMaterial color="#3a3f46" />
      </mesh>
      {/* Extérieur */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[L + 30, W + 30]} />
        <meshLambertMaterial color="#14181d" />
      </mesh>
      {/* Murs (semi-transparents pour voir l'intérieur) */}
      {murs.map((m, i) => (
        <mesh key={i} position={m.position} renderOrder={2}>
          <boxGeometry args={m.taille} />
          <meshLambertMaterial color="#8a96a3" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
      {/* Arêtes hautes des murs */}
      <lineSegments position={[0, H, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(L + ep, 0.001, W + ep)]} />
        <lineBasicMaterial color="#9aa6b2" />
      </lineSegments>
      {layout.portes.map((p) => (
        <PorteQuai key={p.id} porte={p} layout={layout} />
      ))}
      {layout.aires.map((a) => (
        <AireSol key={a.id} aire={a} />
      ))}
    </group>
  );
}

function construireMurs(layout: Layout) {
  const { longueur: L, largeur: W, hauteur: H, epaisseurMur: ep } = layout.batiment;
  const murs: { position: [number, number, number]; taille: [number, number, number] }[] = [];
  const cotes = [
    { mur: 'nord', axe: 'x', fixe: -W / 2, longueur: L },
    { mur: 'sud', axe: 'x', fixe: W / 2, longueur: L },
    { mur: 'ouest', axe: 'z', fixe: -L / 2, longueur: W },
    { mur: 'est', axe: 'z', fixe: L / 2, longueur: W },
  ] as const;
  for (const c of cotes) {
    // Découpe le mur autour des portes.
    const ouvertures = layout.portes.filter((p) => p.mur === c.mur).map((p) => [p.centre - p.largeur / 2, p.centre + p.largeur / 2, p.hauteur] as const);
    ouvertures.sort((a, b) => a[0] - b[0]);
    let debut = -c.longueur / 2;
    const segments: [number, number, number, number][] = []; // a, b, y0, y1
    for (const [a, b, h] of ouvertures) {
      if (a > debut) segments.push([debut, a, 0, H]);
      segments.push([a, b, h, H]); // linteau
      debut = b;
    }
    if (debut < c.longueur / 2) segments.push([debut, c.longueur / 2, 0, H]);
    for (const [a, b, y0, y1] of segments) {
      const centre = (a + b) / 2;
      const lg = b - a;
      const y = (y0 + y1) / 2;
      const h = y1 - y0;
      murs.push(
        c.axe === 'x'
          ? { position: [centre, y, c.fixe], taille: [lg, h, ep] }
          : { position: [c.fixe, y, centre], taille: [ep, h, lg] },
      );
    }
  }
  return murs;
}

function PorteQuai({ porte, layout }: { porte: Porte; layout: Layout }) {
  const { longueur: L, largeur: W } = layout.batiment;
  const horizontal = porte.mur === 'nord' || porte.mur === 'sud';
  const fixe = porte.mur === 'nord' ? -W / 2 : porte.mur === 'sud' ? W / 2 : porte.mur === 'ouest' ? -L / 2 : L / 2;
  const pos: [number, number, number] = horizontal ? [porte.centre, 0, fixe] : [fixe, 0, porte.centre];
  const rot = horizontal ? 0 : Math.PI / 2;
  const hach = useMemo(() => {
    const t = textureHachures('#f5b301').clone();
    t.repeat.set(porte.largeur * 2, 1);
    t.needsUpdate = true;
    return t;
  }, [porte.largeur]);
  const lbl = textureTexte(porte.libelle.toUpperCase(), { couleur: '#0b0e12', fond: '#f5b301', taille: 48 });
  const interieur = porte.mur === 'sud' || porte.mur === 'est' ? -1 : 1;
  return (
    <group position={pos} rotation-y={rot}>
      {/* Montants */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * porte.largeur) / 2, porte.hauteur / 2, 0]}>
          <boxGeometry args={[0.12, porte.hauteur, 0.3]} />
          <meshLambertMaterial color="#f5b301" />
        </mesh>
      ))}
      <mesh position={[0, porte.hauteur, 0]}>
        <boxGeometry args={[porte.largeur + 0.12, 0.12, 0.3]} />
        <meshLambertMaterial color="#f5b301" />
      </mesh>
      {/* Bande de seuil hachurée */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, interieur * 0.35]}>
        <planeGeometry args={[porte.largeur, 0.5]} />
        <meshBasicMaterial map={hach} transparent opacity={0.9} />
      </mesh>
      <sprite position={[0, porte.hauteur + 0.35, 0]} scale={[0.45 * lbl.ratio, 0.45, 1]}>
        <spriteMaterial map={lbl.texture} />
      </sprite>
    </group>
  );
}

function AireSol({ aire }: { aire: Aire }) {
  const { x, z, largeur: w, profondeur: d, couleur } = aire;
  const allee = aire.type === 'allee';
  const bande = 0.07;
  const lbl = textureTexte(aire.nom.toUpperCase(), { couleur: allee ? '#f5b301' : couleur, taille: 56 });
  const hach = useMemo(() => {
    if (aire.type !== 'volumineux') return null;
    const t = textureHachures(couleur).clone();
    t.repeat.set(w * 1.5, d * 1.5);
    t.needsUpdate = true;
    return t;
  }, [aire.type, couleur, w, d]);
  // Allée : texte dans le sens de la plus grande dimension.
  const long = w >= d;
  const hTexte = allee ? 0.32 : 0.45;
  const largeurTexte = Math.min(hTexte * lbl.ratio, (long ? w : d) * 0.9);
  return (
    <group position={[x, 0, z]}>
      {!allee && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]}>
          <planeGeometry args={[w, d]} />
          {hach ? <meshBasicMaterial map={hach} transparent opacity={0.22} /> : <meshBasicMaterial color={couleur} transparent opacity={0.1} />}
        </mesh>
      )}
      {/* Marquage périmétrique (bandes jaunes pour les allées, couleur de l'aire sinon) */}
      {(allee
        ? long
          ? [
              [0, -d / 2, w, bande],
              [0, d / 2, w, bande],
            ]
          : [
              [-w / 2, 0, bande, d],
              [w / 2, 0, bande, d],
            ]
        : [
            [0, -d / 2, w, bande],
            [0, d / 2, w, bande],
            [-w / 2, 0, bande, d],
            [w / 2, 0, bande, d],
          ]
      ).map(([px, pz, sw, sd], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[px, 0.005, pz]}>
          <planeGeometry args={[sw, sd]} />
          <meshBasicMaterial color={allee ? '#f5b301' : couleur} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} rotation-z={long ? 0 : Math.PI / 2} position={[0, 0.007, allee || !long ? 0 : d / 2 - 0.4]}>
        <planeGeometry args={[largeurTexte, largeurTexte / lbl.ratio]} />
        <meshBasicMaterial map={lbl.texture} transparent opacity={allee ? 0.55 : 0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}
