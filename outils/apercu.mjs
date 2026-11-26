// Aperçu caché du site (idée d'Arnaud du 24 nov. 2026) : une copie des pages dans un dossier
// au nom impossible à deviner, pour tester le vrai site avec les vraies données avant la mise en ligne.
// L'accueil de lokalapp.be ne change pas. Chaque page de l'aperçu demande à Google de ne pas l'afficher.
//
// Utilisation : node outils/apercu.mjs <dossier de sortie>
// Crée <dossier de sortie>/apercu-6vqdt5j6tp/ (pages + assets), avec tous les chemins « /… » préfixés.
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DOSSIER = "apercu-6vqdt5j6tp";
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
// Pages de l'aperçu : toutes sauf la page d'erreur (celle du site en ligne reste).
export const pagesApercu = () => readdirSync(RACINE).filter((f) => f.endsWith(".html") && f !== "404.html");

// Version des fichiers : change dès qu'un script ou une feuille de style change. Ajoutée à leurs adresses
// (« admin.js?v=… ») pour que le navigateur ne garde pas l'ancienne version en mémoire après une mise à jour
// (bug du 26 nov. 2026 : nouvelle page, ancien script, le bouton « Lire la page de ce lien » ne faisait rien).
export function versionFichiers(dossier = join(RACINE, "assets")) {
  const h = createHash("sha256");
  for (const f of readdirSync(dossier).filter((x) => /\.(js|css)$/.test(x)).sort()) h.update(f).update(readFileSync(join(dossier, f)));
  return h.digest("hex").slice(0, 10);
}
const avecVersion = (adresse, version) => (version ? `${adresse}?v=${version}` : adresse);

// Une page HTML : chemins préfixés, pas d'adresse « officielle » (canonical), jamais dans Google.
export function transformerPage(html, prefixe = `/${DOSSIER}`, version = "") {
  let s = html.replace(/(\s(?:href|src|action))="\/(?!\/)/g, `$1="${prefixe}/`);
  s = s.replace(new RegExp(`(\\s(?:href|src)=")(${prefixe}/assets/[^"?]+\\.(?:js|css))"`, "g"), (_, a, u) => `${a}${avecVersion(u, version)}"`);
  s = s.replace(/<link rel="canonical"[^>]*>\n?/g, "");
  s = s.replace(/<meta name="robots"[^>]*>\n?/g, "");
  s = s.replace(/(<meta charset="[^"]*">\n?)/, `$1<meta name="robots" content="noindex, nofollow">\n`);
  return s;
}

// Un script : les fichiers chargés par une adresse « /assets/… », et la même version pour ses « import ».
export const transformerScript = (js, prefixe = `/${DOSSIER}`, version = "") =>
  js
    .replace(/(["'`])\/assets\//g, `$1${prefixe}/assets/`)
    .replace(/(\bfrom\s*["'])(\.\/[^"'?]+\.js)(["'])/g, (_, a, u, b) => `${a}${avecVersion(u, version)}${b}`);

export function construire(sortie) {
  const cible = join(sortie, DOSSIER);
  rmSync(cible, { recursive: true, force: true });
  mkdirSync(cible, { recursive: true });
  const version = versionFichiers();
  for (const p of pagesApercu()) writeFileSync(join(cible, p), transformerPage(readFileSync(join(RACINE, p), "utf8"), `/${DOSSIER}`, version));
  cpSync(join(RACINE, "assets"), join(cible, "assets"), { recursive: true });
  for (const f of readdirSync(join(cible, "assets"))) {
    if (!f.endsWith(".js")) continue;
    const chemin = join(cible, "assets", f);
    writeFileSync(chemin, transformerScript(readFileSync(chemin, "utf8"), `/${DOSSIER}`, version));
  }
  return cible;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.error("Utilisation : node outils/apercu.mjs <dossier de sortie>");
    process.exit(1);
  }
  console.log(`Aperçu construit dans ${construire(process.argv[2])}`);
}
