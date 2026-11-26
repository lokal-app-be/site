// Page « Ajouter un événement » : connexion au compte Lokal, puis le formulaire (mêmes règles que l'appli).
import { CATEGORIES, svgIcone, aujourdhuiBelgique, ajouterJours, pastilleDate, lireLieux, chercherLieux, libelleLieu } from "./lokal.js?v=cff84955b0";
import { sb, moi, seDeconnecter } from "./compte.js?v=cff84955b0";
import { $, erreur, occupe, brancherConnexion } from "./connexion.js?v=cff84955b0";
import {
  verifier, datesSerie, nouvelleSerie, positionDepuisAdresse, versLigne, lirePrix, messageErreur, REPETITIONS, DUREE_SERIE_JOURS, tailleReduite,
} from "./formulaire.js?v=cff84955b0";

const aujourdhui = aujourdhuiBelgique();
const VUES = ["chargement", "connexion", "creer", "code", "oubli", "formulaire", "publie"];
let compte = null;

function montrer(vue) {
  for (const v of VUES) $("#" + v).hidden = v !== vue;
  $("#apercu").hidden = vue !== "formulaire";
  const titre = $(`#${vue} h2, #${vue} input`);
  if (vue !== "chargement" && document.activeElement !== document.body) titre?.focus?.({ preventScroll: false });
}
// ================= Compte =================
async function demarrer() {
  try {
    compte = await moi();
  } catch {
    compte = null;
  }
  if (!compte) return montrer("connexion");
  $("#mon-nom").textContent = compte.nom;
  await chargerProfils();
  montrer("formulaire");
  apercu();
}

let messageApresCompte = "";
brancherConnexion({
  montrer,
  apres: async (message) => {
    messageApresCompte = message;
    await demarrer();
  },
});

$("#deconnexion").addEventListener("click", async () => {
  await seDeconnecter();
  compte = null;
  montrer("connexion");
});

// ================= Formulaire =================
const form = $("#formulaire");
form.date.value = aujourdhui;
form.date.min = aujourdhui;
for (const [v, nom] of REPETITIONS) form.repeter.append(new Option(nom, v));

// « Publier en tant que » : moi, ou un de mes profils d'organisateur (espace créateur de l'appli).
let profils = [];
async function chargerProfils() {
  try {
    const { data } = await sb().rpc("mes_createurs");
    profils = Array.isArray(data) ? data : [];
  } catch {
    profils = [];
  }
  const sel = form.createur;
  sel.replaceChildren(new Option("Choisis…", ""), new Option(`Moi (${compte.nom})`, "moi"), ...profils.map((p) => new Option(String(p.nom), String(p.id))));
  $("#ligne-profil").hidden = profils.length === 0;
}

// Type de sortie
let categorie = "";
form.querySelectorAll(".type-btn").forEach((b) =>
  b.addEventListener("click", () => {
    categorie = b.dataset.cat;
    form.querySelectorAll(".type-btn").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    $('[data-champ="categorie"]').classList.remove("faux");
    apercu();
  }),
);

// Village : la liste des villages de Belgique (la même que la recherche de la carte).
let lieux = null;
let lieuChoisi = null;
const chargerLieux = () => (lieux ??= fetch("/apercu-6vqdt5j6tp/assets/carte/lieux-be.json").then((r) => r.json()).then(lireLieux));
const champVillage = $("#village");
const listeVillages = $("#villages");
let choixVillage = -1;
function fermerVillages() {
  listeVillages.hidden = true;
  champVillage.setAttribute("aria-expanded", "false");
  choixVillage = -1;
}
champVillage.addEventListener("input", async () => {
  lieuChoisi = null;
  apercu();
  const q = champVillage.value;
  const trouves = q.trim().length >= 2 ? chercherLieux(q, await chargerLieux(), 5) : [];
  listeVillages.replaceChildren(
    ...trouves.map((l, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.id = "village-" + i;
      b.setAttribute("role", "option");
      b.textContent = libelleLieu(l);
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        lieuChoisi = l;
        champVillage.value = libelleLieu(l);
        fermerVillages();
        apercu();
      });
      li.append(b);
      return li;
    }),
  );
  listeVillages.hidden = !trouves.length;
  champVillage.setAttribute("aria-expanded", trouves.length ? "true" : "false");
});
champVillage.addEventListener("focus", () => chargerLieux().catch(() => undefined), { once: true });
champVillage.addEventListener("blur", () => setTimeout(fermerVillages, 120));
champVillage.addEventListener("keydown", (e) => {
  const options = [...listeVillages.querySelectorAll("button")];
  if (listeVillages.hidden || !options.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    choixVillage = (choixVillage + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options.forEach((o, i) => o.setAttribute("aria-selected", i === choixVillage ? "true" : "false"));
    champVillage.setAttribute("aria-activedescendant", options[choixVillage].id);
  } else if (e.key === "Enter" && choixVillage >= 0) {
    e.preventDefault();
    options[choixVillage].click();
  } else if (e.key === "Escape") fermerVillages();
});

// Répéter
const majSerie = () => {
  const r = form.repeter.value;
  $("#ligne-jusqua").hidden = !r;
  if (r && !form.jusqua.value) form.jusqua.value = ajouterJours(form.date.value || aujourdhui, DUREE_SERIE_JOURS);
  const note = $("#note-serie");
  if (r && form.date.value) {
    const n = datesSerie(form.date.value, r, form.jusqua.value || ajouterJours(form.date.value, DUREE_SERIE_JOURS)).length;
    note.textContent = `${n} date${n > 1 ? "s" : ""} seront publiées (26 au maximum). Chacune se modifie ou s'annule ensuite à part, dans l'appli.`;
    note.hidden = false;
  } else note.hidden = true;
};
form.repeter.addEventListener("change", majSerie);
form.jusqua.addEventListener("change", majSerie);
form.date.addEventListener("change", () => { majSerie(); apercu(); });

// Prix
const lignesPrix = [{ nom: "Entrée", montant: "" }];
function dessinerPrix() {
  const zone = $("#prix");
  zone.replaceChildren(
    ...lignesPrix.map((p, i) => {
      const d = document.createElement("div");
      d.className = "ligne-prix";
      const nom = Object.assign(document.createElement("input"), { className: "champ", value: p.nom, maxLength: 30, placeholder: "Entrée" });
      nom.setAttribute("aria-label", "Nom du prix");
      const montant = Object.assign(document.createElement("input"), { className: "champ", value: p.montant, inputMode: "decimal", placeholder: "0" });
      montant.setAttribute("aria-label", "Montant en euros");
      nom.addEventListener("input", () => (p.nom = nom.value));
      montant.addEventListener("input", () => (p.montant = montant.value));
      d.append(nom, montant);
      if (lignesPrix.length > 1) {
        const x = Object.assign(document.createElement("button"), { type: "button", className: "retirer", textContent: "×" });
        x.setAttribute("aria-label", "Retirer ce prix");
        x.addEventListener("click", () => { lignesPrix.splice(i, 1); dessinerPrix(); });
        d.append(x);
      } else d.append(document.createElement("span"));
      return d;
    }),
  );
  $("#ajouter-prix").hidden = !form.payant.checked || lignesPrix.length >= 6;
}
form.payant.addEventListener("change", () => {
  $("#prix").hidden = !form.payant.checked;
  dessinerPrix();
});
$("#ajouter-prix").addEventListener("click", () => { lignesPrix.push({ nom: "", montant: "" }); dessinerPrix(); });

// Groupe, adresse cachée, privé (comme l'appli : un événement privé n'a ni adresse cachée ni groupe)
const majCases = () => {
  const prive = form.prive.checked;
  form.cacher.disabled = prive;
  form.groupe.disabled = prive;
  $("#ligne-groupe").hidden = prive || !(form.groupe.checked || form.cacher.checked);
  $("#detail-groupe").textContent = form.cacher.checked
    ? "Avec une adresse cachée, on te demande à rejoindre et tu acceptes chaque personne."
    : "Ex. : il manque 2 joueurs pour le quiz. Chacun rejoint le groupe en un geste.";
};
["prive", "cacher", "groupe"].forEach((n) => form[n].addEventListener("change", majCases));

// Affiche
let affiche = null; // Blob JPEG réduit
const depot = $("#depot");
const fichier = $("#fichier");
async function reduire(f) {
  const img = await createImageBitmap(f);
  const { l, h } = tailleReduite(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = l;
  c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, l, h);
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("Image illisible"))), "image/jpeg", 0.85));
}
async function prendreFichier(f) {
  if (!f || !/^image\/(jpeg|png|webp)$/.test(f.type)) return erreur(form, "Choisis une image (JPEG, PNG ou WebP).");
  if (f.size > 15 * 1024 * 1024) return erreur(form, "Cette image est trop lourde (15 Mo au maximum).");
  try {
    affiche = await reduire(f);
    const ap = $("#apercu-affiche");
    const img = $("img", ap);
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(affiche);
    ap.hidden = false;
    depot.hidden = true;
    erreur(form, "");
  } catch {
    erreur(form, "Cette image ne s'ouvre pas. Essaie avec une autre.");
  }
}
fichier.addEventListener("change", () => prendreFichier(fichier.files[0]));
depot.addEventListener("dragover", (e) => { e.preventDefault(); depot.classList.add("survol"); });
depot.addEventListener("dragleave", () => depot.classList.remove("survol"));
depot.addEventListener("drop", (e) => { e.preventDefault(); depot.classList.remove("survol"); prendreFichier(e.dataTransfer.files[0]); });
$("#retirer-affiche").addEventListener("click", () => {
  affiche = null;
  fichier.value = "";
  $("#apercu-affiche").hidden = true;
  depot.hidden = false;
});

// Aperçu de la carte de l'événement
function apercu() {
  $("#ap-titre").textContent = form.titre.value.trim() || "Ton titre ici";
  const lieu = form.lieu.value.trim();
  const village = champVillage.value.trim();
  $("#ap-lieu").textContent = form.cacher.checked ? village || "Ton village" : [lieu, village].filter(Boolean).join(" · ") || "Ton village";
  $("#ap-date").textContent = form.date.value ? pastilleDate({ date: form.date.value, heure: form.heure.value, dateFin: form.dateFin.value > form.date.value ? form.dateFin.value : null }, aujourdhui) : "Date";
  const ico = $("#ap-ico");
  const cat = categorie || "autre";
  ico.style.background = categorie ? CATEGORIES[cat].couleur : "#C9CCD3";
  ico.innerHTML = svgIcone(cat);
}
["titre", "lieu", "heure", "dateFin", "cacher"].forEach((n) => form[n].addEventListener("input", apercu));

// Publier
const CHAMPS = { titre: "titre", date: "date", codePostal: "codePostal", dateFin: "dateFin", createur: "createur" };
form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  form.querySelectorAll(".faux").forEach((n) => n.classList.remove("faux"));
  const s = {
    titre: form.titre.value, categorie, date: form.date.value, heure: form.heure.value || "20:00", village: champVillage.value,
    lieu: form.lieu.value, rue: form.rue.value, numero: form.numero.value, codePostal: form.codePostal.value,
    heureFin: form.heureFin.value, dateFin: form.dateFin.value, payant: form.payant.checked, prix: lignesPrix, description: form.description.value,
  };
  const pb = profils.length && !form.createur.value ? { message: "Choisis le profil avec lequel publier.", champ: "createur" } : verifier(s);
  if (pb) {
    erreur(form, pb.message);
    if (["heureFin", "dateFin", "prix"].includes(pb.champ)) $("#plus").open = true;
    const cible = pb.champ === "categorie" ? $('[data-champ="categorie"]') : pb.champ === "prix" ? $("#prix") : pb.champ === "village" ? champVillage : form.elements[CHAMPS[pb.champ] || pb.champ];
    if (cible) {
      cible.classList.add("faux");
      if (cible.focus) cible.focus();
    }
    return;
  }
  erreur(form, "");
  occupe($("#publier"), () => publier(s));
});

async function publier(s) {
  try {
    const { data: sess } = await sb().auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return montrer("connexion");
    const village = s.village.trim();
    const choisi = lieuChoisi && libelleLieu(lieuChoisi) === village ? lieuChoisi : null;
    const liste = await chargerLieux();
    let pos = choisi && !s.rue.trim() ? choisi : null;
    if (!pos) pos = await positionDepuisAdresse({ village: choisi ? choisi.nom : village, rue: s.rue, numero: s.numero, codePostal: s.codePostal }, liste);
    if (!pos) {
      champVillage.classList.add("faux");
      return erreur(form, "On ne trouve pas ce village en Belgique. Vérifie l'orthographe.");
    }
    const prive = form.prive.checked;
    const cache = form.cacher.checked && !prive;
    let centre = pos;
    if (cache) {
      const c0 = choisi ?? (await positionDepuisAdresse({ village, rue: "", numero: "", codePostal: s.codePostal }, liste));
      // Jamais le point exact en public : sans centre du village, on ne publie pas.
      if (!c0) return erreur(form, "On ne trouve pas le centre de ce village pour cacher l'adresse. Choisis le village dans la liste.");
      centre = c0;
    }
    let photo = null;
    if (affiche) {
      const chemin = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await sb().storage.from("affiches").upload(chemin, affiche, { contentType: "image/jpeg", upsert: false });
      if (up.error) throw up.error;
      photo = chemin;
    }
    const auNom = form.createur.value;
    const groupe = form.groupe.checked;
    const nouvel = {
      organisateur: profils.find((p) => String(p.id) === auNom)?.nom ?? compte.nom,
      createur: auNom && auNom !== "moi" ? auNom : null,
      titre: s.titre, categorie: s.categorie, date: s.date, dateFin: s.dateFin || null, heure: s.heure, heureFin: s.heureFin || null,
      village, lieu: cache ? "" : s.lieu, rue: cache ? "" : s.rue, numero: cache ? "" : s.numero, codePostal: s.codePostal,
      lat: centre.lat, lng: centre.lng,
      groupeTaille: (groupe || cache) && !prive ? Math.min(30, Math.max(2, Number(form.taille.value) || 4)) : null,
      groupeDeja: groupe || cache ? Math.max(1, Number(form.deja.value) || 1) : null,
      description: s.description, prix: s.payant ? lirePrix(s.prix) : [], photo,
      ...(prive ? { prive: true } : {}),
    };
    const r = form.repeter.value;
    const dates = r ? datesSerie(s.date, r, form.jusqua.value || ajouterJours(s.date, DUREE_SERIE_JOURS)) : [s.date];
    const serie = r && dates.length > 1 ? nouvelleSerie() : null;
    const duree = s.dateFin && s.dateFin > s.date ? Math.round((Date.parse(s.dateFin) - Date.parse(s.date)) / 86400000) : 0;
    const lignes = dates.map((d) => versLigne({ ...nouvel, date: d, dateFin: duree ? ajouterJours(d, duree) : null, ...(serie ? { serie, repetition: r } : {}) }));
    const { data, error } = await sb().from("evenements").insert(lignes).select("id,certifie,prive").order("date_debut");
    if (error) throw error;
    const premier = data[0];
    if (cache) {
      const { error: e2 } = await sb().rpc("cacher_adresse", {
        ev: premier.id, lieu: s.lieu.trim() || null, rue: s.rue.trim() || null, numero: s.numero.trim() || null,
        code_postal: s.codePostal.trim() || null, lat: pos.lat, lng: pos.lng,
      });
      if (e2) throw e2;
    }
    $("#t-pub").textContent = s.titre.trim();
    $("#pub-detail").textContent = [
      serie ? `Série publiée : ${dates.length} dates.` : "Ton événement est sur la carte.",
      premier.certifie ? "Il est marqué « Certifié »." : "",
      premier.prive ? "Il est privé : invite tes amis depuis l'appli." : "",
      messageApresCompte,
    ].filter(Boolean).join(" ");
    messageApresCompte = "";
    montrer("publie");
    $("#publie").focus();
  } catch (e) {
    erreur(form, messageErreur(e));
  }
}

$("#encore").addEventListener("click", () => {
  form.reset();
  form.date.value = aujourdhui;
  categorie = "";
  lieuChoisi = null;
  affiche = null;
  lignesPrix.splice(0, lignesPrix.length, { nom: "Entrée", montant: "" });
  form.querySelectorAll(".type-btn").forEach((x) => x.setAttribute("aria-pressed", "false"));
  $("#prix").hidden = true;
  $("#apercu-affiche").hidden = true;
  depot.hidden = false;
  majCases();
  majSerie();
  if (compte) form.createur.value = "";
  montrer("formulaire");
  apercu();
});

// La session peut changer ailleurs (retour de Google ou Facebook, déconnexion dans un autre onglet).
try {
  sb().auth.onAuthStateChange((evenement) => {
    if (evenement === "SIGNED_IN" && !compte) setTimeout(demarrer, 0);
    if (evenement === "SIGNED_OUT") { compte = null; montrer("connexion"); }
  });
} catch {
  // Supabase pas chargé : message ci-dessous
}
demarrer().catch(() => {
  $("#chargement").textContent = "La page ne se charge pas. Vérifie ta connexion et recharge la page.";
});
