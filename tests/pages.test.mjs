// Les pages du site : sécurité (règles du navigateur, pas de clé secrète), mêmes en-tête et pied partout,
// et les règles d'Arnaud (aucun lien vers l'appli ou Google Play avant la sortie dans les stores).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => readFileSync(join(racine, f), "utf8");
const pages = readdirSync(racine).filter((f) => f.endsWith(".html"));
const nosScripts = readdirSync(join(racine, "assets")).filter((f) => f.endsWith(".js")).map((f) => `assets/${f}`);

test("chaque page a ses règles de sécurité (CSP) et aucun script écrit dans la page", () => {
  for (const f of pages) {
    const s = lire(f);
    const csp = s.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, `${f} : pas de CSP`);
    assert.match(csp, /default-src 'none'/, f);
    assert.doesNotMatch(csp, /unsafe-eval/, f);
    assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/, f);
    assert.match(csp, /base-uri 'none'/, f);
    for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/type="application\/ld\+json"/.test(m[1])) continue; // données pour Google, pas du code
      assert.match(m[1], /src="\//, `${f} : script écrit dans la page`);
      assert.equal(m[2].trim(), "", f);
    }
    assert.doesNotMatch(s, /\son[a-z]+="/i, `${f} : code dans un attribut onclick=…`);
  }
});

test("aucun lien vers l'appli ou les stores avant la sortie (règle d'Arnaud du 19 nov. 2026)", () => {
  for (const f of [...pages, ...nosScripts]) {
    assert.doesNotMatch(lire(f), /play\.google\.com|apps\.apple\.com|itunes\.apple\.com|expo\.dev\/|testflight/i, f);
  }
});

test("les fonctions refusées n'apparaissent nulle part", () => {
  for (const f of [...pages, ...nosScripts]) {
    assert.doesNotMatch(lire(f), /covoiturage|r[ée]clame[rz]? ton [ée]v[ée]nement|m[ée]t[ée]o/i, f);
  }
});

test("aucune clé secrète dans le site", () => {
  for (const f of [...pages, ...nosScripts]) {
    const s = lire(f);
    assert.doesNotMatch(s, /service_role|sb_secret_|sk-ant-|re_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}/, f);
  }
  assert.match(lire("assets/lokal.js"), /SUPABASE_CLE = "sb_publishable_/);
});

test("aucune donnée insérée comme du code : innerHTML seulement pour les icônes fixes de l'appli", () => {
  for (const f of nosScripts.filter((x) => !x.includes("maplibre"))) {
    for (const ligne of lire(f).split("\n")) {
      if (/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function\(/.test(ligne)) assert.fail(`${f} : ${ligne.trim()}`);
      if (/innerHTML\s*=/.test(ligne)) assert.match(ligne, /innerHTML = (svgIcone\(|(telephone|retour) \? SVG_RETOUR : SVG_FERMER)/, `${f} : ${ligne.trim()}`);
    }
  }
});

test("mêmes en-tête et pied de page sur toutes les pages publiques", () => {
  const publiques = ["index.html", "organisateurs.html", "communes.html", "ajouter.html", "conditions.html", "confidentialite.html", "mentions-legales.html", "supprimer-compte.html"];
  const sans = (x) => x?.replace(/ aria-current="page"/g, "").replaceAll('href="/#', 'href="#'); // sur l'accueil, « La carte » est sur la même page
  const tete = (f) => sans(lire(f).match(/<header class="tete[\s\S]*?<\/header>/)?.[0]);
  const pied = (f) => sans(lire(f).match(/<footer[\s\S]*?<\/footer>/)?.[0]);
  for (const f of publiques) {
    assert.ok(tete(f), `${f} : pas d'en-tête`);
    assert.equal(tete(f), tete("index.html"), `${f} : en-tête différent`);
    assert.equal(pied(f), pied("index.html"), `${f} : pied de page différent`);
  }
});

test("Admin et Ajouter ne sont pas proposées aux moteurs de recherche", () => {
  assert.match(lire("admin.html"), /<meta name="robots" content="noindex, nofollow">/);
  assert.match(lire("ajouter.html"), /<meta name="robots" content="noindex/);
  assert.doesNotMatch(lire("sitemap.xml"), /\/admin|\/ajouter/);
});

test("la page de suppression du compte reste en place (Google Play la demande)", () => {
  const s = lire("supprimer-compte.html");
  assert.match(s, /supprimer ton compte/i);
  assert.match(lire("sitemap.xml") + lire("robots.txt") + s, /supprimer-compte/);
});
