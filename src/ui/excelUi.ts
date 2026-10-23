import { classeurVersOctets, exporterClasseur, type RapportImport } from '../domain/excel';
import { useStore } from '../store/useStore';
import { horodatageFichier, telecharger } from './telecharger';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Exporte les données courantes au format du mapping actif. */
export function exporterExcel(nom = `INVENTAIRE_MAGASIN_${horodatageFichier()}.xlsx`) {
  const { snapshot, mapping, notifier } = useStore.getState();
  telecharger(nom, classeurVersOctets(exporterClasseur(snapshot, mapping)), XLSX_MIME);
  notifier('info', `Export Excel : ${nom}`);
}

/** Rapport d'import au format CSV (séparateur « ; » pour Excel français). */
export function rapportCsv(r: RapportImport, fichier: string): string {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lignes = [['Fichier', 'Gravité', 'Feuille', 'Ligne', 'Colonne', 'Valeur', 'Raison']];
  for (const e of r.erreursBloquantes) lignes.push([fichier, 'BLOQUANT', e.feuille, String(e.ligne ?? ''), e.colonne ?? '', e.valeur ?? '', e.raison]);
  for (const e of r.rejets) lignes.push([fichier, 'Ligne rejetée', e.feuille, String(e.ligne ?? ''), e.colonne ?? '', e.valeur ?? '', e.raison]);
  for (const a of r.avertissements) lignes.push([fichier, 'Avertissement', '', '', '', '', a]);
  return '﻿' + lignes.map((l) => l.map(q).join(';')).join('\r\n');
}
