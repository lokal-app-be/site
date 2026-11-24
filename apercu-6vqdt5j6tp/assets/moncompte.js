// Page « Mon compte » (choix 1 d'Arnaud du 24 nov. 2026) : se connecter avec le même compte que l'appli,
// voir son profil et ses événements publiés, se déconnecter, supprimer son compte (comme dans l'appli).
// Les règles d'accès de la base (RLS) ne donnent que MES événements et MON profil.
import { CATEGORIES, COLONNES, svgIcone, aujourdhuiBelgique, depuisLigne, pastilleDate } from "./lokal.js";
import { sb, moi, seDeconnecter, etatMien, trierMiens } from "./compte.js";
import { $, erreur, occupe, brancherConnexion } from "./connexion.js";

const aujourdhui = aujourdhuiBelgique();
const VUES = ["chargement", "connexion", "creer", "code", "oubli"];
const BLOCS_COMPTE = ["compte", "miens", "supprimer"];
let compte = null;

function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}

function montrer(vue) {
  for (const v of VUES) $("#" + v).hidden = v !== vue;
  for (const v of BLOCS_COMPTE) $("#" + v).hidden = vue !== "compte";
  const lien = $("#lien-compte");
  if (lien) lien.textContent = vue === "compte" ? "Mon compte" : "Se connecter";
  if (vue === "chargement" || document.activeElement === document.body) return;
  $(vue === "compte" ? "#t-compte" : `#${vue} h2, #${vue} input`)?.focus?.({ preventScroll: false });
}

function rang(dl, etiquette, valeur) {
  const r = el("div", "rang");
  r.append(el("dt", "", etiquette), el("dd", "", valeur));
  dl.append(r);
}

const FOURNISSEURS = { google: "Google", facebook: "Facebook", apple: "Apple", email: "e-mail et mot de passe" };

// Un seul démarrage à la fois (la session est aussi annoncée par Supabase au chargement de la page).
let demarrage = null;
function demarrer(message = "") {
  demarrage ??= lancer(message).finally(() => (demarrage = null));
  return demarrage;
}
async function lancer(message) {
  try {
    compte = await moi();
  } catch {
    compte = null;
  }
  if (!compte) return montrer("connexion");
  $("#mon-nom").textContent = compte.nom;
  const infos = $("#infos");
  infos.replaceChildren();
  const p = compte.profil;
  if (p) rang(infos, "Nom (privé)", `${p.prenom} ${p.nom}`);
  rang(infos, "Pseudo", p?.pseudo?.trim() || "pas encore de pseudo");
  if (compte.email) rang(infos, "E-mail", compte.email);
  rang(infos, "Connexion", `avec ${FOURNISSEURS[compte.fournisseur] ?? compte.fournisseur}`);
  const msg = $("#message-compte");
  msg.textContent = message;
  msg.hidden = !message;
  montrer("compte");
  chargerMiens();
  // Équipe Lokal : le lien vers l'Admin (la base vérifie elle-même, ce lien n'ouvre rien d'autre).
  sb().rpc("est_admin").then(({ data }) => ($("#lien-admin").hidden = data !== true), () => undefined);
}

function ligneMien(e) {
  const etat = etatMien(e, aujourdhui);
  const ligne = el("article", `mien${etat.passe ? " passe" : ""}`);
  const ico = el("span", "ico");
  ico.style.background = CATEGORIES[e.categorie].couleur;
  ico.innerHTML = svgIcone(e.categorie); // icône fixe de l'appli, jamais une donnée
  ico.setAttribute("aria-hidden", "true");
  const corps = el("div", "mien-corps");
  const pills = el("div", "pills");
  pills.append(el("span", "pdate", pastilleDate(e, aujourdhui)));
  if (etat.texte) pills.append(el("span", `etat${etat.alerte ? " alerte" : ""}`, etat.texte));
  corps.append(pills, el("b", "", e.titre), el("small", "", [e.lieu, e.village].filter(Boolean).join(" · ")));
  if (etat.carte) {
    const a = el("a", "", "Voir sur la carte");
    a.href = `./?e=${encodeURIComponent(e.id)}#carte`; // relatif : marche aussi dans l'aperçu caché
    corps.append(a);
  }
  ligne.append(ico, corps);
  return ligne;
}

// Mes événements et Scannés par toi : deux listes repliées, avec leur nombre (demande d'Arnaud du 24 nov. 2026).
function remplir(cle, liste, vide) {
  const zone = $(`#liste-${cle}`);
  const nombre = $(`#n-${cle}`);
  nombre.textContent = String(liste.length);
  nombre.hidden = false;
  zone.replaceChildren(...(liste.length ? liste.map(ligneMien) : [el("p", "vide", vide)]));
}

async function chargerMiens() {
  const zone = $("#liste-miens");
  $("#n-miens").hidden = true;
  $("#d-scannes").hidden = true;
  zone.replaceChildren(el("p", "vide", "Chargement…"));
  try {
    const { data, error } = await sb().from("evenements").select(`${COLONNES},visibilite,prive`).eq("cree_par", compte.id).order("date_debut").limit(500);
    if (error) throw error;
    const liste = (data ?? []).map((l) => ({ ...depuisLigne(l), visibilite: l.visibilite, prive: !!l.prive }));
    const { miens, scannes } = trierMiens(liste, aujourdhui);
    remplir("miens", miens, scannes.length ? "Tu n'as encore publié aucun événement toi-même." : "Tu n'as encore publié aucun événement.");
    if (scannes.length) {
      remplir("scannes", scannes, "");
      $("#d-scannes").hidden = false;
    }
  } catch {
    zone.replaceChildren(el("p", "vide", "Tes événements n'ont pas pu être chargés. Réessaie dans un moment."));
  }
}

brancherConnexion({ montrer, apres: (message) => demarrer(message) });

$("#deconnexion").addEventListener("click", async () => {
  await seDeconnecter();
  compte = null;
  montrer("connexion");
});

// Supprimer mon compte : comme dans l'appli (photos de profil, photos d'affiches, puis le compte dans la base).
const fenetre = $("#confirmer");
$("#bouton-supprimer").addEventListener("click", () => fenetre.showModal());
$("#non-supprimer").addEventListener("click", () => fenetre.close());
$("#oui-supprimer").addEventListener("click", (ev) => occupe(ev.currentTarget, async () => {
  const bloc = $("#supprimer");
  try {
    const id = compte?.id;
    if (!id) throw new Error("Pas de compte");
    for (const seau of ["photos-profil", "affiches"]) {
      const { data: fichiers } = await sb().storage.from(seau).list(id, { limit: 1000 });
      if (fichiers?.length) await sb().storage.from(seau).remove(fichiers.map((f) => `${id}/${f.name}`));
    }
    const { error } = await sb().rpc("supprimer_mon_compte");
    if (error) throw error;
    await sb().auth.signOut({ scope: "local" });
    fenetre.close();
    compte = null;
    erreur(bloc, "");
    montrer("connexion");
    const t = $("#t-cnx");
    t.textContent = "Ton compte est supprimé";
  } catch {
    fenetre.close();
    erreur(bloc, "La suppression n'a pas marché. Réessaie.");
  }
}));

// La session peut changer ailleurs (retour de Google ou Facebook, déconnexion dans un autre onglet).
try {
  sb().auth.onAuthStateChange((evenement) => {
    if (evenement === "SIGNED_IN" && !compte) setTimeout(demarrer, 0);
    if (evenement === "SIGNED_OUT" && compte) {
      compte = null;
      montrer("connexion");
    }
  });
} catch {
  // Supabase pas chargé : message ci-dessous
}
demarrer().catch(() => {
  $("#chargement").textContent = "La page ne se charge pas. Vérifie ta connexion et recharge la page.";
});
