// Rôles SIMULÉS — aucune sécurité réelle : le choix du rôle est libre dans l'interface.
export type Role = 'lecteur' | 'magasinier' | 'administrateur';
export type Action = 'consulter' | 'mouvement' | 'reinitialiser' | 'importer' | 'editer-layout';

const DROITS: Record<Role, Action[]> = {
  lecteur: ['consulter'],
  magasinier: ['consulter', 'mouvement'],
  administrateur: ['consulter', 'mouvement', 'reinitialiser', 'importer', 'editer-layout'],
};

export function peut(role: Role, action: Action): boolean {
  return DROITS[role].includes(action);
}
