// Connexion au compte Lokal (Google, Facebook ou e-mail, créer un compte, code, mot de passe oublié) :
// la même partie sur « Ajouter un événement » et « Mon compte ». Les pages ont les mêmes blocs HTML
// (#connexion, #creer, #code, #oubli) ; chacune dit comment montrer un bloc et quoi faire une fois connecté.
import { seConnecter, connexionSociale, creerCompte, confirmerCode, renvoyerCode, envoyerCodeOubli, nouveauMotDePasse, verifierInscription, emailValide, motDePasseValide, messageErreurCompte } from "./compte.js";

export const $ = (s, r = document) => r.querySelector(s);
export const SANS_PSEUDO = "Compte créé. Ce pseudo n'a pas pu être gardé (déjà pris ou pas autorisé) : choisis-en un autre dans l'appli, Modifier mon profil.";
export function erreur(form, message) {
  const p = $(".erreur", form);
  p.textContent = message || "";
  p.hidden = !message;
}
export async function occupe(bouton, travail) {
  bouton.disabled = true;
  bouton.setAttribute("aria-busy", "true");
  try {
    return await travail();
  } finally {
    bouton.disabled = false;
    bouton.removeAttribute("aria-busy");
  }
}

// montrer(vue) : affiche un bloc ; apres(message) : une fois connecté (message : à dire après la création du compte).
export function brancherConnexion({ montrer, apres }) {
  document.querySelectorAll("[data-vers]").forEach((b) => b.addEventListener("click", () => montrer(b.dataset.vers)));

  document.querySelectorAll("[data-fournisseur]").forEach((b) =>
    b.addEventListener("click", () => occupe(b, async () => {
      try {
        await connexionSociale(b.dataset.fournisseur);
      } catch (e) {
        erreur($("#f-cnx"), messageErreurCompte(e));
      }
    })),
  );

  $("#f-cnx").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    if (!emailValide(f.email.value)) return erreur(f, "Cet e-mail n'a pas l'air correct.");
    if (!f.mdp.value) return erreur(f, "Ajoute ton mot de passe.");
    occupe($("button[type=submit]", f), async () => {
      try {
        await seConnecter(f.email.value, f.mdp.value);
        erreur(f, "");
        f.mdp.value = "";
        await apres("");
      } catch (e) {
        erreur(f, messageErreurCompte(e));
      }
    });
  });

  $("#f-creer").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const v = { prenom: f.prenom.value, nom: f.nom.value, pseudo: f.pseudo.value, email: f.email.value, motDePasse: f.mdp.value };
    const pb = verifierInscription(v);
    if (pb) return erreur(f, pb);
    occupe($("button[type=submit]", f), async () => {
      try {
        const r = await creerCompte(v);
        erreur(f, "");
        if (r === "code") return montrer("code");
        await apres(r === "sans-pseudo" ? SANS_PSEUDO : "");
      } catch (e) {
        erreur(f, messageErreurCompte(e));
      }
    });
  });

  $("#f-code").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    if (!/^\d{6}$/.test(f.code.value.trim())) return erreur(f, "Le code a 6 chiffres. Tu le trouves dans l'e-mail.");
    occupe($("button[type=submit]", f), async () => {
      try {
        const r = await confirmerCode(f.code.value);
        erreur(f, "");
        await apres(r === "sans-pseudo" ? SANS_PSEUDO : "");
      } catch (e) {
        erreur(f, messageErreurCompte(e));
      }
    });
  });
  $("#renvoyer").addEventListener("click", (ev) => occupe(ev.currentTarget, async () => {
    try {
      await renvoyerCode();
      erreur($("#f-code"), "Nouveau code envoyé.");
    } catch (e) {
      erreur($("#f-code"), messageErreurCompte(e));
    }
  }));

  $("#f-oubli").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const suite = $(".oubli-suite", f);
    const bouton = $("button[type=submit]", f);
    if (!emailValide(f.email.value)) return erreur(f, "Cet e-mail n'a pas l'air correct.");
    occupe(bouton, async () => {
      try {
        if (suite.hidden) {
          await envoyerCodeOubli(f.email.value);
          suite.hidden = false;
          bouton.textContent = "Changer mon mot de passe";
          erreur(f, "");
          f.code.focus();
          return;
        }
        if (!/^\d{6}$/.test(f.code.value.trim())) return erreur(f, "Le code a 6 chiffres. Tu le trouves dans l'e-mail.");
        if (!motDePasseValide(f.mdp.value)) return erreur(f, "Ton mot de passe doit avoir au moins 8 caractères.");
        await nouveauMotDePasse(f.email.value, f.code.value, f.mdp.value);
        erreur(f, "");
        await apres("");
      } catch (e) {
        erreur(f, messageErreurCompte(e));
      }
    });
  });
}
