import { describe, expect, it } from 'vitest';
import { applyMouvement, quantiteA, stockDisponible, stockStandby, stockTotal } from '../src/domain/engine';
import type { MouvementInput, Snapshot } from '../src/domain/types';
import { E1, E2, U, magasinVide } from './helpers';

function ok(s: Snapshot, m: MouvementInput): Snapshot {
  const r = applyMouvement(s, m);
  if (!r.ok) throw new Error(r.error);
  return r.snapshot;
}

function avecStock(q = 10): Snapshot {
  return ok(magasinVide(), { Type: 'ENTREE', ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: q, Utilisateur: U });
}

describe('Moteur de stock', () => {
  it('1. une entrée augmente le stock', () => {
    const s0 = magasinVide();
    const s1 = ok(s0, { Type: 'ENTREE', ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: 7, Utilisateur: U });
    expect(stockDisponible(s0, 'ART-1')).toBe(0);
    expect(quantiteA(s1, 'ART-1', E1)).toBe(7);
    const s2 = ok(s1, { Type: 'ENTREE', ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: 3, Utilisateur: U });
    expect(stockDisponible(s2, 'ART-1')).toBe(10);
    expect(s2.stocks.find((x) => x.EmplacementID === E1)!.Version).toBe(2);
  });

  it('2. une sortie diminue le stock', () => {
    const s = ok(avecStock(10), { Type: 'SORTIE', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 4, Utilisateur: U });
    expect(stockDisponible(s, 'ART-1')).toBe(6);
  });

  it('3. une sortie excessive est refusée avec un message clair, sans modification', () => {
    const s = avecStock(10);
    const r = applyMouvement(s, { Type: 'SORTIE', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 11, Utilisateur: U });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/refusé.*11 demandé.*10 disponible/);
    expect(stockDisponible(s, 'ART-1')).toBe(10);
    expect(s.mouvements).toHaveLength(1);
    // Quantités nulles, négatives ou décimales refusées.
    for (const q of [0, -1, 1.5]) {
      expect(applyMouvement(s, { Type: 'SORTIE', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: q, Utilisateur: U }).ok).toBe(false);
    }
  });

  it('4. un transfert conserve le total (et est atomique)', () => {
    const s0 = avecStock(10);
    const s1 = ok(s0, { Type: 'TRANSFERT', ArticleID: 'ART-1', EmplacementSource: E1, EmplacementDestination: E2, Quantite: 6, Utilisateur: U });
    expect(quantiteA(s1, 'ART-1', E1)).toBe(4);
    expect(quantiteA(s1, 'ART-1', E2)).toBe(6);
    expect(stockTotal(s1, 'ART-1')).toBe(stockTotal(s0, 'ART-1'));
    // Destination inconnue : rien ne bouge, pas même la source.
    const r = applyMouvement(s1, { Type: 'TRANSFERT', ArticleID: 'ART-1', EmplacementSource: E1, EmplacementDestination: 'X-X99-N01-E01', Quantite: 2, Utilisateur: U });
    expect(r.ok).toBe(false);
    expect(quantiteA(s1, 'ART-1', E1)).toBe(4);
    // Transfert excessif refusé.
    expect(applyMouvement(s1, { Type: 'TRANSFERT', ArticleID: 'ART-1', EmplacementSource: E1, EmplacementDestination: E2, Quantite: 5, Utilisateur: U }).ok).toBe(false);
  });

  it('5. le calcul multi-emplacements est correct', () => {
    let s = avecStock(10);
    s = ok(s, { Type: 'ENTREE', ArticleID: 'ART-1', EmplacementDestination: E2, Quantite: 5, Utilisateur: U });
    s = ok(s, { Type: 'ENTREE', ArticleID: 'ART-2', EmplacementDestination: E2, Quantite: 8, Utilisateur: U });
    expect(stockDisponible(s, 'ART-1')).toBe(15);
    expect(stockDisponible(s, 'ART-2')).toBe(8);
    expect(s.stocks.filter((x) => x.ArticleID === 'ART-1').map((x) => x.EmplacementID).sort()).toEqual([E1, E2].sort());
    // Une sortie ne peut puiser que dans l'emplacement indiqué.
    const r = applyMouvement(s, { Type: 'SORTIE', ArticleID: 'ART-1', EmplacementSource: E2, Quantite: 6, Utilisateur: U });
    expect(r.ok).toBe(false);
  });

  it('6. chaque mouvement est historisé', () => {
    let s = magasinVide();
    const seq: MouvementInput[] = [
      { Type: 'ENTREE', ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: 10, Utilisateur: U, Motif: 'Réception' },
      { Type: 'SORTIE', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 2, Utilisateur: U, Destination: 'Atelier' },
      { Type: 'TRANSFERT', ArticleID: 'ART-1', EmplacementSource: E1, EmplacementDestination: E2, Quantite: 3, Utilisateur: U },
      { Type: 'STANDBY_DEPART', ArticleID: 'ART-1', EmplacementSource: E2, Quantite: 1, Utilisateur: U, Chantier: 'Chantier X' },
      { Type: 'AJUSTEMENT', ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: 4, Utilisateur: U, Motif: 'Inventaire' },
    ];
    for (const m of seq) s = ok(s, m);
    expect(s.mouvements.map((m) => m.Type)).toEqual(['ENTREE', 'SORTIE', 'TRANSFERT', 'STANDBY_DEPART', 'AJUSTEMENT']);
    expect(new Set(s.mouvements.map((m) => m.MouvementID)).size).toBe(5);
    for (const m of s.mouvements) {
      expect(m.MouvementID).toMatch(/^[0-9a-f-]{36}$/);
      expect(m.Utilisateur).toBe(U);
      expect(Date.parse(m.DateHeure)).not.toBeNaN();
    }
    expect(s.mouvements[4].Ecart).toBe(-1);
    // Un mouvement refusé n'est pas historisé.
    const r = applyMouvement(s, { Type: 'SORTIE', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 99, Utilisateur: U });
    expect(r.ok).toBe(false);
  });

  it('7. un UUID rejoué ne crée pas de doublon', () => {
    const id = '0b6f1d0e-1111-4222-8333-444455556666';
    const m: MouvementInput = { MouvementID: id, Type: 'ENTREE', ArticleID: 'ART-1', EmplacementDestination: E1, Quantite: 5, Utilisateur: U };
    const s1 = ok(magasinVide(), m);
    const r = applyMouvement(s1, m);
    expect(r.ok && r.duplicate).toBe(true);
    if (r.ok) expect(r.snapshot).toBe(s1);
    expect(stockDisponible(s1, 'ART-1')).toBe(5);
    expect(s1.mouvements.filter((x) => x.MouvementID === id)).toHaveLength(1);
  });

  it('8. un aller-retour stand-by conserve le total', () => {
    const s0 = avecStock(10);
    const s1 = ok(s0, { Type: 'STANDBY_DEPART', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 4, Utilisateur: U, Chantier: 'Poste A', StandbyID: 'SB-1' });
    expect(stockDisponible(s1, 'ART-1')).toBe(6);
    expect(stockStandby(s1, 'ART-1')).toBe(4);
    expect(stockTotal(s1, 'ART-1')).toBe(10);
    // Le matériel en stand-by n'est pas disponible.
    expect(applyMouvement(s1, { Type: 'SORTIE', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 7, Utilisateur: U }).ok).toBe(false);
    const s2 = ok(s1, { Type: 'STANDBY_RETOUR', ArticleID: 'ART-1', StandbyID: 'SB-1', Quantite: 4, Utilisateur: U });
    expect(quantiteA(s2, 'ART-1', E1)).toBe(10);
    expect(stockTotal(s2, 'ART-1')).toBe(10);
    expect(s2.standbys[0].Statut).toBe('clos');
    expect(applyMouvement(s2, { Type: 'STANDBY_RETOUR', ArticleID: 'ART-1', StandbyID: 'SB-1', Quantite: 1, Utilisateur: U }).ok).toBe(false);
  });

  it('9. stand-by consommé = sortie', () => {
    const base = avecStock(10);
    const viaStandby = ok(
      ok(base, { Type: 'STANDBY_DEPART', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 3, Utilisateur: U, Chantier: 'Poste B', StandbyID: 'SB-2' }),
      { Type: 'STANDBY_CONSOMME', ArticleID: 'ART-1', StandbyID: 'SB-2', Quantite: 3, Utilisateur: U },
    );
    const viaSortie = ok(base, { Type: 'SORTIE', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 3, Utilisateur: U });
    expect(stockTotal(viaStandby, 'ART-1')).toBe(stockTotal(viaSortie, 'ART-1'));
    expect(stockTotal(viaStandby, 'ART-1')).toBe(7);
    const qtes = (s: Snapshot) => s.stocks.map((x) => [x.ArticleID, x.EmplacementID, x.Quantite]);
    expect(qtes(viaStandby)).toEqual(qtes(viaSortie));
    expect(viaStandby.standbys[0].Statut).toBe('clos');
    // Consommation partielle : le reste demeure en stand-by.
    const p = ok(
      ok(base, { Type: 'STANDBY_DEPART', ArticleID: 'ART-1', EmplacementSource: E1, Quantite: 3, Utilisateur: U, Chantier: 'Poste C', StandbyID: 'SB-3' }),
      { Type: 'STANDBY_CONSOMME', ArticleID: 'ART-1', StandbyID: 'SB-3', Quantite: 1, Utilisateur: U },
    );
    expect(stockStandby(p, 'ART-1')).toBe(2);
    expect(stockTotal(p, 'ART-1')).toBe(9);
  });
});
