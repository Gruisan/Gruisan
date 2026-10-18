const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtJour = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtNombre = new Intl.NumberFormat('fr-FR');
const fmtPct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });

export const dateHeure = (iso: string | null | undefined) => (iso ? fmtDate.format(new Date(iso)) : '—');
export const jour = (iso: string | null | undefined) => (iso ? fmtJour.format(new Date(iso)) : '—');
export const heure = (iso: string) => fmtHeure.format(new Date(iso));
export const nombre = (n: number) => fmtNombre.format(n);
export const pct = (n: number) => fmtPct.format(n);

/** Couleur d'occupation d'un emplacement (partagée entre la 3D et les légendes). */
export function couleurOccupation(taux: number, vide: boolean): string {
  if (vide) return '#2b3440';
  if (taux >= 0.9) return '#e5484d';
  if (taux >= 0.6) return '#f5a524';
  if (taux >= 0.25) return '#30a46c';
  return '#5eb88a';
}

export const LEGENDE_OCCUPATION = [
  { libelle: 'Vide', couleur: couleurOccupation(0, true) },
  { libelle: '< 25 %', couleur: couleurOccupation(0.1, false) },
  { libelle: '25–60 %', couleur: couleurOccupation(0.4, false) },
  { libelle: '60–90 %', couleur: couleurOccupation(0.7, false) },
  { libelle: '≥ 90 %', couleur: couleurOccupation(0.95, false) },
];
