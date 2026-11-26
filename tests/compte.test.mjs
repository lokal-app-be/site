// Le compte Lokal sur le site (assets/compte.js) : mêmes règles et mêmes messages que l'appli.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emailValide, verifierInscription, problemePseudo, nomPublic, profilDepuisFournisseur, messageErreurCompte, etatMien, trierMiens } from "../assets/compte.js";

test("inscription : prénom, nom, e-mail, 8 caractères, pseudo de 3 caractères sans @", () => {
  const v = { prenom: "Camille", nom: "Dubois", email: "camille@exemple.be", motDePasse: "12345678", pseudo: "" };
  assert.equal(verifierInscription(v), null);
  assert.equal(verifierInscription({ ...v, prenom: "" }), "Ajoute ton prénom.");
  assert.equal(verifierInscription({ ...v, email: "camille@" }), "Cet e-mail n'a pas l'air correct.");
  assert.equal(verifierInscription({ ...v, motDePasse: "1234567" }), "Ton mot de passe doit avoir au moins 8 caractères.");
  assert.match(problemePseudo("camille@gmail.com"), /C'est une adresse e-mail/);
  assert.equal(problemePseudo("lu"), "Ton pseudo doit avoir au moins 3 caractères.");
  assert.equal(problemePseudo("lulu_bure"), null);
  assert.equal(emailValide(" a@b.be "), true);
});

test("le nom public ne montre jamais le nom de famille en entier", () => {
  assert.equal(nomPublic({ prenom: "Camille", nom: "dubois", pseudo: null }), "Camille D.");
  assert.equal(nomPublic({ prenom: "Camille", nom: "Dubois", pseudo: "lulu" }), "lulu");
  assert.equal(nomPublic(null), "Invité Lokal");
});

test("Google ou Facebook : prénom et nom repris du fournisseur", () => {
  assert.deepEqual(profilDepuisFournisseur({ given_name: "Camille", family_name: "Dubois" }), { prenom: "Camille", nom: "Dubois", pseudo: null });
  assert.deepEqual(profilDepuisFournisseur({ full_name: "Jean Pierre Martin" }), { prenom: "Jean", nom: "Pierre Martin", pseudo: null });
  assert.equal(profilDepuisFournisseur({ name: "Cher" }), null);
});

test("messages d'erreur du compte", () => {
  assert.equal(messageErreurCompte({ code: "invalid_credentials" }), "E-mail ou mot de passe incorrect.");
  assert.equal(messageErreurCompte({ code: "user_already_exists" }), "Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.");
  assert.equal(messageErreurCompte({ code: "otp_expired" }), "Ce code n'est pas bon ou a expiré. Vérifie-le, ou demande un nouveau code.");
  assert.equal(messageErreurCompte({ code: "over_email_send_rate_limit" }), "Trop d'essais. Attends quelques minutes.");
});

test("mes événements : état affiché et lien vers la carte seulement pour un événement public à venir", () => {
  const auj = "2026-11-24";
  const base = { date: "2026-11-28", dateFin: null, visibilite: "visible", statut: "prevu", prive: false };
  assert.deepEqual(etatMien(base, auj), { texte: null, alerte: false, carte: true, passe: false });
  assert.equal(etatMien({ ...base, visibilite: "retire" }, auj).texte, "Retiré par l'équipe Lokal");
  assert.equal(etatMien({ ...base, visibilite: "masque" }, auj).carte, false);
  assert.equal(etatMien({ ...base, statut: "annule" }, auj).texte, "Annulé");
  assert.equal(etatMien({ ...base, prive: true }, auj).texte, "Privé");
  assert.equal(etatMien({ ...base, prive: true }, auj).carte, false);
  assert.deepEqual(etatMien({ ...base, date: "2026-11-20" }, auj), { texte: "Passé", alerte: false, carte: false, passe: true });
  assert.equal(etatMien({ ...base, date: "2026-11-20", dateFin: "2026-11-30" }, auj).carte, true);
});

test("mes événements : à venir d'abord, passés ensuite, scannés à part", () => {
  const e = (id, date, source = "appli", heure = "20:00") => ({ id, titre: id, date, dateFin: null, heure, source });
  const { miens, scannes } = trierMiens([e("passe", "2026-11-01"), e("tard", "2026-12-05"), e("tot", "2026-11-28", "appli", "09:00"), e("scan", "2026-11-29", "affiche")], "2026-11-24");
  assert.deepEqual(miens.map((x) => x.id), ["tot", "tard", "passe"]);
  assert.deepEqual(scannes.map((x) => x.id), ["scan"]);
});
