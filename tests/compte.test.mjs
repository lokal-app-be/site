// Le compte Lokal sur le site (assets/compte.js) : mêmes règles et mêmes messages que l'appli.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emailValide, verifierInscription, problemePseudo, nomPublic, profilDepuisFournisseur, messageErreurCompte } from "../assets/compte.js";

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
