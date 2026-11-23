// « Ajouter un événement » sur le site (assets/formulaire.js) : les mêmes règles que l'appli.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifier, datesSerie, MAX_DATES_SERIE, nouvelleSerie, positionDepuisAdresse, versLigne, lirePrix, messageErreur, tailleReduite,
  variantesSalle, adresseDuLieu, oublierDerniereRecherche,
} from "../assets/formulaire.js";
import { lireLieux } from "../assets/lokal.js";

const base = { titre: "Souper", categorie: "fete", date: "2026-11-28", village: "Bure", codePostal: "", payant: false, prix: [] };

test("les règles du formulaire, dans l'ordre et avec les mots de l'appli", () => {
  assert.equal(verifier(base), null);
  assert.equal(verifier({ ...base, titre: " " }).champ, "titre");
  assert.equal(verifier({ ...base, categorie: "" }).message, "Choisis le type de sortie pour publier.");
  assert.equal(verifier({ ...base, date: "" }).champ, "date");
  assert.equal(verifier({ ...base, village: "" }).champ, "village");
  assert.equal(verifier({ ...base, codePostal: "692" }).message, "Le code postal doit avoir 4 chiffres.");
  assert.equal(verifier({ ...base, payant: true, prix: [{ nom: "", montant: "" }] }).champ, "prix");
  assert.equal(verifier({ ...base, payant: true, prix: [{ nom: "", montant: "abc" }] }).message, "Un prix n'est pas un nombre.");
  assert.equal(verifier({ ...base, payant: true, prix: [{ nom: "", montant: "12,50" }] }), null);
});

test("événements récurrents : chaque semaine, chaque mois au même rang, 26 dates au plus", () => {
  assert.deepEqual(datesSerie("2026-11-28", "7", "2026-12-15"), ["2026-11-28", "2026-12-05", "2026-12-12"]);
  assert.deepEqual(datesSerie("2026-11-28", "14", "2026-12-31"), ["2026-11-28", "2026-12-12", "2026-12-26"]);
  // 4e samedi de novembre -> 4e samedi des mois suivants
  assert.deepEqual(datesSerie("2026-11-28", "m", "2027-01-31"), ["2026-11-28", "2026-12-26", "2027-01-23"]);
  // 5e dimanche : les mois sans 5e dimanche sont sautés
  assert.ok(datesSerie("2026-11-29", "m", "2027-06-30").every((d) => Number(d.slice(8)) >= 29));
  assert.equal(datesSerie("2026-01-01", "7", "2030-01-01").length, MAX_DATES_SERIE);
  assert.match(nouvelleSerie(), /^[0-9a-f-]{36}$/);
});

const lieux = lireLieux([["Bure", "Tellin", 50.09, 5.26, 2], ["Tellin", "Tellin", 50.08, 5.21, 1]]);
const reponse = (d) => async () => ({ ok: true, json: async () => d });

test("position : l'adresse si elle est trouvée, sinon le centre du village (jamais Bruxelles)", async () => {
  oublierDerniereRecherche();
  const p1 = await positionDepuisAdresse({ village: "Bure", rue: "Rue de la Station", numero: "12" }, lieux, reponse([{ lat: "50.1", lon: "5.3" }]));
  assert.deepEqual(p1, { lat: 50.1, lng: 5.3, precision: "adresse" });
  oublierDerniereRecherche();
  const p2 = await positionDepuisAdresse({ village: "Bure", rue: "Rue inconnue" }, lieux, reponse([]));
  assert.deepEqual(p2, { lat: 50.09, lng: 5.26, precision: "village" });
  const p3 = await positionDepuisAdresse({ village: "Bure" }, lieux, async () => { throw new Error("hors ligne"); });
  assert.deepEqual(p3, { lat: 50.09, lng: 5.26, precision: "village" });
  oublierDerniereRecherche();
  const p4 = await positionDepuisAdresse({ village: "Bure", rue: "Rue X" }, lieux, async () => { throw new Error("hors ligne"); });
  assert.equal(p4.precision, "village");
  assert.equal(await positionDepuisAdresse({ village: " " }, lieux, reponse([])), null);
});

test("OpenStreetMap : une recherche par seconde au plus", async () => {
  oublierDerniereRecherche();
  const heures = [];
  const f = async () => (heures.push(Date.now()), { ok: true, json: async () => [] });
  await positionDepuisAdresse({ village: "Bure", rue: "A" }, lieux, f);
  await positionDepuisAdresse({ village: "Bure", rue: "B" }, lieux, f);
  assert.ok(heures[1] - heures[0] >= 1000);
});

test("le nom de la salle sans rue : la salle près du village, jamais le village lui-même ni trop loin", async () => {
  assert.deepEqual(variantesSalle("Palais des Congrès et cinémas"), ["Palais des Congrès et cinémas", "Palais des Congrès"]);
  const bure = { nom: "Bure", lat: 50.09, lng: 5.26 };
  oublierDerniereRecherche();
  const ok = await adresseDuLieu("Salle Saint-Lambert", bure, reponse([{ lat: "50.091", lon: "5.261", category: "amenity", address: { road: "Rue du Centre", house_number: "4", postcode: "6927" } }]));
  assert.deepEqual(ok, { lat: 50.091, lng: 5.261, rue: "Rue du Centre", numero: "4", codePostal: "6927" });
  oublierDerniereRecherche();
  assert.equal(await adresseDuLieu("Salle", bure, reponse([{ lat: "50.09", lon: "5.26", category: "place" }])), null);
  oublierDerniereRecherche();
  assert.equal(await adresseDuLieu("Salle", bure, reponse([{ lat: "50.85", lon: "4.35", category: "amenity" }])), null);
});

test("la ligne envoyée à la base a les mêmes colonnes que l'appli", () => {
  const l = versLigne({ organisateur: " Comité ", titre: " Souper ", categorie: "fete", date: "2026-11-28", dateFin: "2026-11-28", heure: "19:00", heureFin: "", village: "Bure", lieu: "", rue: "Rue A", numero: "", codePostal: "6927", lat: 50, lng: 5, description: " ", prix: [{ nom: "", montant: 12.5 }], photo: null });
  assert.equal(l.organisateur, "Comité");
  assert.equal(l.date_fin, null);
  assert.equal(l.heure_fin, null);
  assert.equal(l.description, null);
  assert.deepEqual(l.prix, [{ nom: "Entrée", montant: 12.5 }]);
  assert.equal(l.statut, "prevu");
  assert.equal("cree_par" in l, false); // la base met la personne connectée elle-même
  assert.equal("certifie" in l, false); // jamais choisi par la page
  const g = versLigne({ ...l, organisateur: "x", titre: "x", date: "2026-11-28", village: "Bure", prix: [], groupeTaille: 6, groupeDeja: 9 });
  assert.equal(g.groupe_deja, 5);
  assert.deepEqual(lirePrix([{ nom: "", montant: "12,5" }, { nom: "Enfants", montant: "" }]), [{ nom: "Entrée", montant: 12.5 }]);
});

test("messages d'erreur et taille de l'affiche", () => {
  assert.equal(messageErreur({ message: "Limite de 20 événements" }), "Tu as déjà publié 20 événements aujourd'hui. Réessaie demain.");
  assert.equal(messageErreur({ message: "Failed to fetch" }), "Pas de connexion. Vérifie ton internet et réessaie.");
  assert.equal(messageErreur(null), "Ça n'a pas marché. Réessaie dans un instant.");
  assert.deepEqual(tailleReduite(2800, 4000), { l: 1400, h: 2000 });
  assert.deepEqual(tailleReduite(800, 600), { l: 800, h: 600 });
});
