/** Propose un fichier à l'utilisateur (fonctionne en file://, sans serveur). */
export function telecharger(nom: string, contenu: BlobPart, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const horodatageFichier = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
