// Aperçu caché : chaque page reste dans son dossier, n'est jamais proposée à Google,
// et ne touche pas au site en ligne (pas de 404, pas de CNAME, pas de plan du site).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DOSSIER, construire, pagesApercu, transformerPage, transformerScript } from "../outils/apercu.mjs";

test("le nom du dossier est impossible à deviner", () => {
  assert.match(DOSSIER, /^apercu-[a-z0-9]{10}$/);
});

test("une page : chemins préfixés, pas de canonical, noindex une seule fois", () => {
  const html = '<head>\n<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">\n<link rel="canonical" href="https://lokalapp.be/">\n<link rel="stylesheet" href="/assets/site.css">\n</head><a href="/#carte">x</a><a href="/">y</a><a href="https://lokalapp.be/e/1">z</a><img src="/assets/images/lokal.png"><a href="//exemple.be">w</a>';
  const s = transformerPage(html, "/apercu-x");
  assert.ok(s.includes('href="/apercu-x/assets/site.css"'));
  assert.ok(s.includes('href="/apercu-x/#carte"'));
  assert.ok(s.includes('href="/apercu-x/"'));
  assert.ok(s.includes('src="/apercu-x/assets/images/lokal.png"'));
  assert.ok(s.includes('href="https://lokalapp.be/e/1"'));
  assert.ok(s.includes('href="//exemple.be"'));
  assert.ok(!s.includes("canonical"));
  assert.equal(s.match(/name="robots"/g).length, 1);
});

test("un script : les fichiers /assets/ sont préfixés", () => {
  const js = 'fetch("/assets/carte/jour.json"); loadImage(`/assets/reperes/${c}.png`); x = "https://a.be/assets/b";';
  const s = transformerScript(js, "/apercu-x");
  assert.ok(s.includes('fetch("/apercu-x/assets/carte/jour.json")'));
  assert.ok(s.includes("`/apercu-x/assets/reperes/"));
  assert.ok(s.includes('"https://a.be/assets/b"'));
});

test("le dossier construit : toutes les pages, aucun chemin hors du dossier, jamais dans Google", () => {
  const sortie = mkdtempSync(join(tmpdir(), "apercu-"));
  try {
    const cible = construire(sortie);
    assert.deepEqual(readdirSync(sortie), [DOSSIER]);
    for (const f of ["404.html", "CNAME", "sitemap.xml", "robots.txt"]) assert.ok(!existsSync(join(cible, f)), f);
    assert.ok(pagesApercu().includes("index.html") && pagesApercu().includes("admin.html"));
    for (const p of pagesApercu()) {
      const s = readFileSync(join(cible, p), "utf8");
      assert.match(s, /<meta name="robots" content="noindex, nofollow">/, p);
      assert.ok(!/\s(?:href|src|action)="\/(?!\/|apercu-)/.test(s), `chemin hors du dossier dans ${p}`);
    }
    for (const f of readdirSync(join(cible, "assets")).filter((x) => x.endsWith(".js"))) {
      const s = readFileSync(join(cible, "assets", f), "utf8");
      assert.ok(!/["'`]\/assets\//.test(s), `chemin /assets/ hors du dossier dans ${f}`);
    }
  } finally {
    rmSync(sortie, { recursive: true, force: true });
  }
});
