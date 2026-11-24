// Aperçu caché du site (idée d'Arnaud du 24 nov. 2026) : une copie des pages dans un dossier
// au nom impossible à deviner, pour tester le vrai site avec les vraies données avant la mise en ligne.
// L'accueil de lokalapp.be ne change pas. Chaque page de l'aperçu demande à Google de ne pas l'afficher.
//
// Utilisation : node outils/apercu.mjs <dossier de sortie>
// Crée <dossier de sortie>/apercu-6vqdt5j6tp/ (pages + assets), avec tous les chemins « /… » préfixés.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DOSSIER = "apercu-6vqdt5j6tp";
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
// Pages de l'aperçu : toutes sauf la page d'erreur (celle du site en ligne reste).
export const pagesApercu = () => readdirSync(RACINE).filter((f) => f.endsWith(".html") && f !== "404.html");

// Une page HTML : chemins préfixés, pas d'adresse « officielle » (canonical), jamais dans Google.
export function transformerPage(html, prefixe = `/${DOSSIER}`) {
  let s = html.replace(/(\s(?:href|src|action))="\/(?!\/)/g, `$1="${prefixe}/`);
  s = s.replace(/<link rel="canonical"[^>]*>\n?/g, "");
  s = s.replace(/<meta name="robots"[^>]*>\n?/g, "");
  s = s.replace(/(<meta charset="[^"]*">\n?)/, `$1<meta name="robots" content="noindex, nofollow">\n`);
  return s;
}

// Un script : les fichiers chargés par une adresse « /assets/… ».
export const transformerScript = (js, prefixe = `/${DOSSIER}`) => js.replace(/(["'`])\/assets\//g, `$1${prefixe}/assets/`);

export function construire(sortie) {
  const cible = join(sortie, DOSSIER);
  rmSync(cible, { recursive: true, force: true });
  mkdirSync(cible, { recursive: true });
  for (const p of pagesApercu()) writeFileSync(join(cible, p), transformerPage(readFileSync(join(RACINE, p), "utf8")));
  cpSync(join(RACINE, "assets"), join(cible, "assets"), { recursive: true });
  for (const f of readdirSync(join(cible, "assets"))) {
    if (!f.endsWith(".js")) continue;
    const chemin = join(cible, "assets", f);
    writeFileSync(chemin, transformerScript(readFileSync(chemin, "utf8")));
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
