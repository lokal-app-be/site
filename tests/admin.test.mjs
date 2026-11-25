// Admin Lokal sur le site (assets/admin-lib.js) : mêmes règles et mêmes textes que l'écran Admin de l'appli.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  texteMotif, lireActivite, resumeActivite, detailAlerte, parCommune, communeDuVillage, nomSource, lirePrixTexte, versBrouillons,
  trouverLieu, titresProches, dejaSurLokal, messageScan, cadreValide, cadrePixels, tailleScan, natureTexte, texteOrigine, pluriel,
  filtrerNonCertifies, dureeImport, emailAdminValide, formatNombre, LIGNES_STATS, partsEcrans,
} from "../assets/admin-lib.js";
import { lireLieux } from "../assets/lokal.js";

const lieux = lireLieux([["Tellin", "Tellin", 50.08, 5.21, 1], ["Bure", "Tellin", 50.09, 5.26, 2], ["Grupont", "Tellin", 50.09, 5.28, 2], ["Rochefort", "Rochefort", 50.16, 5.22, 1], ["Han-sur-Lesse", "Rochefort", 50.12, 5.19, 2]]);

test("motifs, origines et pluriels avec les mots de l'appli", () => {
  assert.equal(texteMotif("arnaque"), "Arnaque ou faux événement");
  assert.equal(texteMotif("inconnu"), "inconnu");
  assert.equal(texteOrigine("affiche"), "affiche scannée");
  assert.equal(texteOrigine("agenda"), "agenda de la commune");
  assert.equal(texteOrigine("appli"), "publié par un invité");
  assert.equal(pluriel(1, "signalement"), "1 signalement");
  assert.equal(pluriel(3, "signalement"), "3 signalements");
  assert.equal(formatNombre(2431).replace(/\s/g, " "), "2 431");
  assert.equal(LIGNES_STATS.map((g) => g[0]).join(","), "Utilisateurs,Événements,Sorties,Scans d'affiches,Amis et messages,Sécurité");
});

test("quand Lokal sert le plus : heure de pointe, jour, part de la nuit", () => {
  const h = Array(24).fill(0);
  h[20] = 60; h[23] = 20; h[2] = 20;
  const a = lireActivite({ ouvertures_heure: h, ouvertures_jour: [1, 1, 1, 1, 9, 2, 1], ecrans: { fiche: 3, carte: 9 } });
  assert.deepEqual(resumeActivite(a), { pointe: "20 h – 21 h", jour: "vendredi", nuit: 40 });
  assert.deepEqual(a.ecrans[0], ["carte", 9]);
  assert.equal(resumeActivite(lireActivite(null)), null);
  assert.equal(a.ouverturesHeure.length, 24);
});

test("alertes d'abus et événements sans rue par commune", () => {
  assert.equal(detailAlerte({ scan: 3, parrainage: 5 }), "5 ★ parrainages · 3 ★ scans");
  assert.equal(communeDuVillage("Bure", lieux), "Tellin");
  assert.equal(communeDuVillage("Han-sur-Lesse (Rochefort)", lieux), "Rochefort");
  assert.equal(communeDuVillage("Inconnu", lieux), "Inconnu");
  const r = parCommune([{ village: "Bure", total: 10, sans_rue: 4 }, { village: "Tellin", total: 5, sans_rue: 1 }, { village: "Rochefort", total: 9, sans_rue: 2 }], (v) => communeDuVillage(v, lieux));
  assert.deepEqual(r, [{ commune: "Tellin", total: 15, sansRue: 5 }, { commune: "Rochefort", total: 9, sansRue: 2 }]);
});

test("scanner : texte, lien ou réseau social", () => {
  assert.deepEqual(natureTexte("https://tellin.be/agenda"), { lien: "https://tellin.be/agenda" });
  assert.equal(natureTexte("http://tellin.be").erreur, "Le lien doit commencer par https://");
  assert.equal(natureTexte("https://www.facebook.com/events/1").erreur, messageScan("reseau_social"));
  assert.equal(natureTexte("trop court").erreur, "Colle d'abord le texte de l'annonce");
  assert.equal(natureTexte("Grand feu de Bure le samedi 28 novembre à 19 h").texte.length > 20, true);
  assert.equal(natureTexte("x".repeat(9000)).texte.length, 6000);
  assert.equal(nomSource("https://www.tellin.be/agenda?x=1"), "tellin.be");
  assert.equal(nomSource("https://fb.me/abc"), "Facebook");
  assert.equal(messageScan("limite"), "Plafond atteint : 300 scans par jour pour l'équipe Lokal.");
  assert.match(messageScan("???"), /^La lecture n'a pas marché/);
});

test("les brouillons lus par Claude : prix, date passée, étranger, valeurs nettoyées", () => {
  assert.deepEqual(lirePrixTexte("Entrée 5 €, enfants 2,50 €"), [{ nom: "Entrée", montant: 5 }, { nom: "Enfants", montant: 2.5 }]);
  assert.deepEqual(lirePrixTexte("Entrée libre"), []);
  const [a, b, c] = versBrouillons({ evenements: [
    { titre: "Grand feu", date: "2026-11-28", heure: "25:00", village: "Bure", commune: "Tellin", pays: "Belgique", categorie: "fete", code_postal: "69270", cadre: [0, 0, 1, 1] },
    { titre: "Brocante", date: "2026-11-01", heure: "08:00", pays: "BE", categorie: "pirate" },
    { titre: "Fête à Givet", date: "2026-11-28", pays: "France" },
  ] }, "2026-11-23");
  assert.equal(a.heure, "20:00");
  assert.equal(a.codePostal, "");
  assert.equal(a.organisateur, "Organisateur inconnu");
  assert.equal(a.passe, false);
  assert.equal(b.passe, true);
  assert.equal(b.categorie, "autre");
  assert.equal(c.etranger, true);
  assert.deepEqual(versBrouillons(null, "2026-11-23"), []);
});

test("le lieu lu sur l'affiche, dans la bonne commune", () => {
  assert.equal(trouverLieu({ village: "Bure", commune: "Tellin" }, lieux).nom, "Bure");
  assert.equal(trouverLieu({ village: "", commune: "Rochefort" }, lieux).nom, "Rochefort");
  assert.equal(trouverLieu({ village: "Bure", commune: "Rochefort" }, lieux)?.nom ?? null, "Rochefort");
  assert.equal(trouverLieu({ village: "Qwrtz", commune: "" }, lieux), null);
});

test("déjà sur Lokal : même jour, même endroit, titre proche", () => {
  assert.equal(titresProches("Intersection #7", "Incidence - Intersection #7"), true);
  assert.equal(titresProches("Grand feu de Bure", "Souper du foot"), false);
  const existants = [{ id: "e1", titre: "Grand feu de Bure", date: "2026-11-28", dateFin: null, village: "Bure", lat: 50.09, lng: 5.26 }];
  const bure = lieux[1];
  assert.equal(dejaSurLokal({ titre: "Le grand feu de Bure", date: "2026-11-28" }, existants, bure)?.id, "e1");
  assert.equal(dejaSurLokal({ titre: "Grand feu de Bure", date: "2026-11-29" }, existants, bure), null);
  assert.equal(dejaSurLokal({ titre: "Grand feu de Bure", date: "2026-11-28" }, existants, lieux[3]), null); // Rochefort : plus de 3 km
});

test("photo d'un panneau : chaque affiche découpée d'après son cadre", () => {
  assert.equal(cadreValide([0.1, 0.1, 0.5, 0.6]), true);
  assert.equal(cadreValide([0.5, 0.1, 0.1, 0.6]), false);
  assert.equal(cadreValide([0, 0, 0.1, 0.1]), false); // trop petit
  assert.deepEqual(cadrePixels([0.1, 0.1, 0.5, 0.6], 1000, 800), { x: 100, y: 80, l: 400, h: 400 });
  assert.equal(cadrePixels([0, 0, 1, 1], 1000, 800), null);
  assert.deepEqual(tailleScan(3000, 4000), { l: 1200, h: 1600 });
  assert.deepEqual(tailleScan(800, 600), { l: 800, h: 600 });
});

test("non certifiés : recherche sans accents et filtre par origine", () => {
  const l = [
    { titre: "Concert à l'église", organisateur: "Fabrique", village: "Grupont", source: "affiche" },
    { titre: "Marche", organisateur: "ADEPS", village: "Bure", source: "import" },
    { titre: "Bal", organisateur: "Patro", village: "Tellin", source: "appli" },
  ];
  assert.equal(filtrerNonCertifies(l, "EGLISE", "").length, 1);
  assert.equal(filtrerNonCertifies(l, "", "invite")[0].titre, "Bal");
  assert.equal(filtrerNonCertifies(l, "bure", "import").length, 1);
  assert.equal(filtrerNonCertifies(l, "bure", "affiche").length, 0);
});

test("imports et équipe", () => {
  assert.equal(dureeImport("2026-11-23T12:00:00Z", "2026-11-23T12:00:38Z"), "38 s");
  assert.equal(dureeImport("2026-11-23T12:00:00Z", "2026-11-23T12:05:00Z"), "5 min");
  assert.equal(dureeImport("2026-11-23T12:00:00Z", null), "");
  assert.equal(emailAdminValide("camille@gmail.com"), true);
  assert.equal(emailAdminValide("camille@gmail"), false);
});

test("écrans les plus vus : en % de toutes les vues", () => {
  const p = partsEcrans([["carte", 600], ["fiche", 395], ["profil", 5]]);
  assert.deepEqual(p.map((x) => x.texte), ["60 %", "40 %", "< 1 %"]);
  assert.equal(partsEcrans([["carte", 3], ["fiche", 1]])[0].texte, "75 %");
  assert.deepEqual(partsEcrans([]), []);
  assert.equal(partsEcrans([["carte", 0]])[0].texte, "0 %");
});
