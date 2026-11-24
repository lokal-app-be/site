// Outils communs du site (assets/lokal.js). Lancer : node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aujourdhuiBelgique, joursDuWeekend, periode, dansPeriode, pastilleDate, bientot, ajouterJours, depuisLigne, urlAffiche,
  imageAgendaOk, texteEntree, adresseComplete, lireLieux, chercherLieux, distanceKm, ecarter, TELLIN, svgIcone, positionUtilisable } from "../assets/lokal.js";

test("aujourd'hui est la date belge, pas celle de l'ordinateur", () => {
  assert.equal(aujourdhuiBelgique(new Date("2026-11-22T23:30:00Z")), "2026-11-23"); // 0 h 30 à Bruxelles
});

test("« Ce week-end » va du vendredi au dimanche, le vendredi à partir de 18 h", () => {
  assert.deepEqual(joursDuWeekend("2026-11-24"), ["2026-11-27", "2026-11-28", "2026-11-29"]); // un mardi
  assert.deepEqual(joursDuWeekend("2026-11-28"), ["2026-11-28", "2026-11-29"]); // un samedi
  assert.deepEqual(joursDuWeekend("2026-11-29"), ["2026-11-29"]); // un dimanche
  const p = periode("weekend", "2026-11-24");
  assert.equal(dansPeriode({ date: "2026-11-27", heure: "14:00" }, p), false);
  assert.equal(dansPeriode({ date: "2026-11-27", heure: "20:00" }, p), true);
  assert.equal(dansPeriode({ date: "2026-11-27", heure: "14:00", dateFin: "2026-11-28" }, p), true);
});

test("pastille de date et « c'est ce soir ! » comme l'appli", () => {
  assert.equal(pastilleDate({ date: "2026-11-23", heure: "20:00" }, "2026-11-23"), "AUJ. · 20:00");
  assert.match(pastilleDate({ date: "2026-11-28", heure: "20:00" }, "2026-11-23"), /^SAM 28\.11 · 20:00$/);
  assert.equal(pastilleDate({ date: "2026-10-25", dateFin: "2026-10-27", heure: "14:00" }, "2026-10-01"), "25.10 → 27.10 · 14:00");
  assert.equal(bientot({ date: "2026-11-23", heure: "20:00" }, "2026-11-23"), "c'est ce soir !");
  assert.equal(bientot({ date: ajouterJours("2026-11-23", 1), heure: "20:00" }, "2026-11-23"), "c'est demain !");
});

test("photo d'affiche : seulement le dossier public de Lokal ou les images des agendas", () => {
  assert.match(urlAffiche("abc/1.jpg"), /\/storage\/v1\/object\/public\/affiches\/abc\/1\.jpg$/);
  assert.equal(urlAffiche("https://exemple.com/x.jpg"), null);
  assert.equal(urlAffiche("../secret.jpg"), null);
  assert.equal(imageAgendaOk("https://www.odwb.be/api/explore/v2.1/catalog/datasets/evenements-en-wallonie/files/a"), true);
  assert.equal(imageAgendaOk("https://pirate.be/x.jpg"), false);
  const e = depuisLigne({ id: "1", source: "agenda", image_url: "https://pirate.be/x.jpg", categorie: "inconnue", date_debut: "2026-11-28", heure_debut: "20:00:00", prix: [{ nom: "Entrée", montant: "5" }, { montant: -1 }], lat: "50", lng: "5", source_url: "javascript:alert(1)" });
  assert.equal(e.photo, null);
  assert.equal(e.categorie, "autre");
  assert.equal(e.heure, "20:00");
  assert.equal(e.sourceUrl, null);
  assert.deepEqual(e.prix, [{ nom: "Entrée", montant: 5 }]);
});

test("entrée et adresse comme la fiche de l'appli", () => {
  assert.equal(texteEntree({ prix: [], source: "appli" }), "Gratuit");
  assert.equal(texteEntree({ prix: [], source: "agenda" }), "Pas précisé (voir la description)");
  assert.equal(texteEntree({ prix: [{ nom: "Entrée", montant: 12.5 }], source: "appli" }), "Entrée : 12,50 €");
  assert.equal(adresseComplete({ rue: "Rue de la Gare", numero: "3", codePostal: "6927", village: "Tellin" }), "Rue de la Gare 3, 6927 Tellin");
  assert.equal(adresseComplete({ village: "Bure" }), "Bure");
});

test("recherche de villages : accents, fautes de frappe, villages avant communes homonymes", () => {
  const lieux = lireLieux([["Tellin", "Tellin", 50.08, 5.21, 1], ["Bure", "Tellin", 50.09, 5.26, 2], ["Resteigne", "Tellin", 50.09, 5.18, 2], ["Rochefort", "Rochefort", 50.16, 5.22, 1]]);
  assert.equal(chercherLieux("bure", lieux)[0].nom, "Bure");
  assert.equal(chercherLieux("Resteinge", lieux)[0].nom, "Resteigne");
  assert.equal(chercherLieux("r", lieux).length, 0);
  assert.equal(lieux[1].estCommune, false);
});

test("Tellin par défaut, jamais Bruxelles ; distances ; points écartés à la même adresse", () => {
  assert.ok(Math.abs(TELLIN.lat - 50.08) < 0.01 && Math.abs(TELLIN.lng - 5.22) < 0.01);
  assert.ok(Math.abs(distanceKm({ lat: 50.08, lng: 5.21 }, { lat: 50.16, lng: 5.22 }) - 8.9) < 0.5);
  const r = ecarter([{ id: "a", lat: 50, lng: 5 }, { id: "b", lat: 50, lng: 5 }]);
  assert.notEqual(r[0].latAff, r[1].latAff);
});

test("les icônes sont le dessin fixe de l'appli (aucune donnée dedans)", () => {
  assert.match(svgIcone("fete"), /^<svg /);
  assert.equal(svgIcone("<script>"), svgIcone("autre"));
});

test("bouton Ma position : précise et en Belgique seulement", () => {
  assert.equal(positionUtilisable(50.16, 5.22, 30), "ok"); // Rochefort, GPS
  assert.equal(positionUtilisable(50.16, 5.22, 2500), "ok");
  assert.equal(positionUtilisable(50.88, 4.7, 20000), "floue"); // devinée par le réseau
  assert.equal(positionUtilisable(50.16, 5.22, undefined), "floue");
  assert.equal(positionUtilisable(48.85, 2.35, 20), "hors"); // Paris
});
