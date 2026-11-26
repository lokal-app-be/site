// Admin Lokal et page Fondateur sur le site (lokalapp.be/admin). Cette page ne fait qu'afficher :
// chaque lecture et chaque décision passe par une fonction de la base qui vérifie le rôle de la personne
// connectée (admin ou fondateur). Un compte qui n'est pas de l'équipe ne reçoit rien.
// Aucune donnée n'est insérée comme du code dans la page : tout passe par textContent.
import { sb, moi, seDeconnecter, connexionSociale, messageErreurCompte } from "./compte.js";
import {
  SUPABASE_URL, SUPABASE_CLE, COLONNES, CATEGORIES, svgIcone, depuisLigne, formatJour, aujourdhuiBelgique, lireLieux,
  libelleLieu, chercherLieux, adresseComplete, texteEntree, texteQuand, pastilleDate,
} from "./lokal.js";
import {
  texteMotif, SIGNALEMENTS_POUR_MASQUER, LIGNES_STATS, formatNombre, lireActivite, NOMS_ECRANS, partsEcrans, lireStatutAdmin, codeValide, messageErreurCode, imageQr, natureLien, JOURS_COURTS, resumeActivite,
  detailAlerte, parCommune, communeDuVillage, nomSource, lienSourceValide, versBrouillons, trouverLieu, dejaSurLokal, messageScan,
  cadrePixels, tailleScan, natureTexte, texteOrigine, pluriel, filtrerNonCertifies, dureeImport, emailAdminValide,
} from "./admin-lib.js";
import { positionDepuisAdresse, adresseDuLieu, versLigne, messageErreur } from "./formulaire.js";

const $ = (id) => document.getElementById(id);

// Petit outil : un élément avec ses attributs et son texte (jamais de HTML venant des données).
function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "texte") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const e of enfants.flat()) if (e !== null && e !== undefined && e !== false) n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  return n;
}
const icone = (cat, petit) => {
  const c = CATEGORIES[cat] ? cat : "autre";
  const n = el("span", { class: petit ? "ico petit" : "ico" });
  n.style.background = CATEGORIES[c].couleur;
  n.innerHTML = svgIcone(c); // dessin fixe de l'appli, jamais une donnée
  return n;
};
const vider = (n, ...enfants) => n.replaceChildren(...enfants.flat().filter((e) => e !== null && e !== undefined && e !== false));
const vide = (texte) => el("p", { class: "vide", texte });
const jourCourt = (iso) => formatJour(iso.slice(0, 10), { day: "numeric", month: "short" });
const HEURE_BE = new Intl.DateTimeFormat("fr-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" });
const JOUR_BE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }); // AAAA-MM-JJ
function quand(horodatage) {
  const d = new Date(horodatage);
  const jour = JOUR_BE.format(d);
  const auj = aujourdhuiBelgique();
  const h = HEURE_BE.format(d).replace(" ", "");
  if (jour === auj) return `Aujourd'hui ${h}`;
  const hier = new Date(Date.parse(auj + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  if (jour === hier) return `Hier ${h}`;
  return `${formatJour(jour)} ${h}`;
}

// ---- Message court en bas de l'écran (comme l'appli) ----
const toastNoeud = el("div", { class: "toast", role: "status", "aria-live": "polite", hidden: true });
document.body.append(toastNoeud);
let toastMinuterie = 0;
function toast(texte) {
  toastNoeud.textContent = texte;
  toastNoeud.hidden = false;
  clearTimeout(toastMinuterie);
  toastMinuterie = setTimeout(() => (toastNoeud.hidden = true), 3800);
}

// ---- Fenêtre : « Voir » un événement, ou confirmer un geste important ----
const fenetre = $("fenetre");
const corpsFenetre = $("fenetre-corps");
const fermerFenetre = $("fermer-fenetre");
fermerFenetre.addEventListener("click", () => fenetre.close());
fenetre.addEventListener("click", (e) => {
  if (e.target === fenetre) fenetre.close();
});
function confirmer(titre, texte, bouton, annuler = "Annuler") {
  return new Promise((ok) => {
    let choix = false;
    const oui = el("button", { class: "btn danger petit", type: "button", texte: bouton, onclick: () => ((choix = true), fenetre.close()) });
    const non = el("button", { class: "btn sec petit", type: "button", texte: annuler, onclick: () => fenetre.close() });
    vider(corpsFenetre, el("h2", { id: "f-titre", texte: titre }), el("p", { texte }), el("div", { class: "actions" }, oui, non));
    fermerFenetre.hidden = true;
    fenetre.addEventListener("close", () => ((fermerFenetre.hidden = false), ok(choix)), { once: true });
    fenetre.showModal();
    non.focus();
  });
}
async function voir(id) {
  vider(corpsFenetre, el("p", { class: "note", texte: "Un instant…" }));
  fermerFenetre.hidden = false;
  if (!fenetre.open) fenetre.showModal();
  try {
    // Les admins voient aussi les événements masqués ou retirés (règle d'accès de la base).
    const { data, error } = await sb().from("evenements").select(COLONNES + ",visibilite").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return vider(corpsFenetre, el("p", { texte: "Cet événement n'existe plus." }));
    const e = depuisLigne(data);
    const lignes = [
      ["Quand", [formatJour(e.date, { weekday: "long", day: "numeric", month: "long" }) + (e.journee ? "" : ` · ${e.heure}`), texteQuand(e)].filter(Boolean).join("\n")],
      ["Où", [e.lieu, e.adresseCachee ? `${e.village} (adresse cachée aux visiteurs)` : adresseComplete(e)].filter(Boolean).join("\n")],
      ["Organisateur", e.organisateur],
      ["Entrée", texteEntree(e)],
      ["Origine", e.certifie ? "certifié par l'organisateur" : texteOrigine(e.source)],
      ["Sur Lokal", { visible: "visible", masque: "masqué (3 signalements)", retire: "retiré par l'équipe Lokal" }[data.visibilite] ?? data.visibilite],
      ["Description", e.description || ""],
    ].filter(([, v]) => v);
    const dl = el("dl", {}, lignes.flatMap(([t, v]) => [el("dt", { texte: t }), el("dd", { texte: v })]));
    const source = e.sourceUrl ? el("p", { class: "note" }, "Source : ", el("a", { href: e.sourceUrl, target: "_blank", rel: "noopener noreferrer", texte: e.sourceNom || nomSource(e.sourceUrl) })) : null;
    vider(
      corpsFenetre,
      e.photo ? el("img", { src: e.photo, alt: "L'affiche", loading: "lazy" }) : null,
      el("div", { class: "ligne-titre" }, icone(e.categorie), el("div", {}, el("h2", { id: "f-titre", texte: e.titre }), el("span", { class: "pills" }, el("span", { class: "pdate", texte: pastilleDate(e, aujourdhuiBelgique()) }), el("span", { class: e.certifie ? "pastille ok" : "pastille", texte: e.certifie ? "Certifié" : "Non certifié" })))),
      dl,
      source,
    );
  } catch (err) {
    vider(corpsFenetre, el("p", { class: "erreur", texte: messageErreur(err) }));
  }
}

// ---- Les écrans ----
const ECRANS = ["ecran-connexion", "ecran-refus", "ecran-code", "ecran-attente", "ecran-admin"];
const montrer = (id) => ECRANS.forEach((x) => ($(x).hidden = x !== id));
let fondateur = false;
let lieux = null;
const chargerLieux = () => (lieux ??= fetch("/assets/carte/lieux-be.json").then((r) => r.json()).then(lireLieux));

document.querySelectorAll("[data-fournisseur]").forEach((b) =>
  b.addEventListener("click", async () => {
    $("erreur-cnx").hidden = true;
    try {
      await connexionSociale(b.dataset.fournisseur);
    } catch (err) {
      $("erreur-cnx").textContent = messageErreurCompte(err);
      $("erreur-cnx").hidden = false;
    }
  }),
);
document.querySelectorAll("[data-deconnexion]").forEach((b) =>
  b.addEventListener("click", async () => {
    await seDeconnecter().catch(() => undefined);
    location.hash = "";
    montrer("ecran-connexion");
  }),
);

async function demarrer() {
  montrer("ecran-attente");
  let m = null;
  try {
    m = await moi();
  } catch {
    m = null;
  }
  if (!m) return montrer("ecran-connexion");
  // Une invitation à cette adresse devient active à la première connexion Google ou Facebook (comme l'appli).
  await sb().rpc("activer_invitation_admin").then(() => undefined, () => undefined);
  const { data: brut, error } = await sb().rpc("admin_statut");
  const statut = error ? "non" : lireStatutAdmin(brut);
  if (statut === "code_a_creer" || statut === "code_a_taper") return montrerCode(statut);
  if (statut !== "ok") {
    $("texte-refus").textContent = m.email
      ? `Ce compte (${m.email}) ne fait pas partie de l'équipe Lokal.`
      : "Ce compte ne fait pas partie de l'équipe Lokal.";
    return montrer("ecran-refus");
  }
  const { data: f } = await sb().rpc("est_fondateur");
  fondateur = f === true;
  $("role").textContent = fondateur ? "Fondateur" : "Admin";
  $("nom-moi").textContent = m.nom;
  document.querySelectorAll(".fondateur-seul").forEach((n) => (n.hidden = !fondateur));
  montrer("ecran-admin");
  aller();
  // Les compteurs du menu, tout de suite.
  for (const p of ["signalements", "messages", "retires"]) if (p !== partieActive) charger(p, { silencieux: true });
  if (fondateur && partieActive !== "alertes") charger("alertes", { silencieux: true });
}

// ---- Code Google Authenticator (la base exige une session « aal2 » pour tout ce qui est admin) ----
let facteurNouveau = null;
function montrerCode(statut) {
  facteurNouveau = null;
  const creer = statut === "code_a_creer";
  $("titre-code").textContent = creer ? "Protège ton compte admin" : "Code Google Authenticator";
  $("code-creer").hidden = !creer;
  $("code-nouveau").hidden = true;
  $("note-taper").hidden = creer;
  $("form-code").hidden = creer;
  $("erreur-code").hidden = true;
  $("champ-code").value = "";
  montrer("ecran-code");
  (creer ? $("bouton-creer-code") : $("champ-code")).focus();
}
const erreurCode = (texte) => {
  $("erreur-code").textContent = texte;
  $("erreur-code").hidden = !texte;
};
$("bouton-creer-code").addEventListener("click", async (ev) => {
  const b = ev.currentTarget;
  b.disabled = true;
  erreurCode("");
  try {
    const { data: liste } = await sb().auth.mfa.listFactors();
    // Un essai abandonné (code jamais validé) : on le retire pour repartir proprement (comme l'appli).
    for (const f of liste?.all ?? []) if (f.factor_type === "totp" && f.status !== "verified") await sb().auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb().auth.mfa.enroll({ factorType: "totp", friendlyName: "Lokal admin", issuer: "Lokal" });
    if (error || !data) throw error ?? new Error("Code impossible à créer");
    facteurNouveau = data.id;
    const qr = imageQr(data.totp.qr_code); // image fournie par Supabase (data:image/svg+xml), jamais une adresse extérieure
    $("qr-code").hidden = !qr;
    if (qr) $("qr-code").src = qr;
    $("ouvrir-authenticator").href = data.totp.uri;
    $("cle-code").textContent = data.totp.secret;
    $("code-creer").hidden = true;
    $("code-nouveau").hidden = false;
    $("form-code").hidden = false;
    $("titre-code").textContent = "Ajoute Lokal dans Google Authenticator";
    $("titre-code").focus();
  } catch (err) {
    erreurCode(messageErreurCode(err));
  } finally {
    b.disabled = false;
  }
});
$("copier-cle").addEventListener("click", () => {
  navigator.clipboard?.writeText($("cle-code").textContent).then(() => ($("copier-cle").textContent = "Clé copiée"), () => undefined);
});
$("form-code").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const code = $("champ-code").value.trim();
  if (!codeValide(code)) return erreurCode("Le code a 6 chiffres. Tu le trouves dans Google Authenticator.");
  const bouton = ev.currentTarget.querySelector("button");
  bouton.disabled = true;
  erreurCode("");
  try {
    let id = facteurNouveau;
    if (!id) {
      const { data } = await sb().auth.mfa.listFactors();
      id = data?.totp?.find((f) => f.status === "verified")?.id;
    }
    if (!id) throw new Error("Pas de code Google Authenticator sur ce compte");
    const { error } = await sb().auth.mfa.challengeAndVerify({ factorId: id, code });
    if (error) throw error;
    await demarrer();
  } catch (err) {
    erreurCode(messageErreurCode(err));
  } finally {
    bouton.disabled = false;
  }
});

// ---- Les parties (une à la fois, l'adresse garde la partie : #signalements, #stats…) ----
const PARTIES_FONDATEUR = ["stats", "usage", "imports", "sans-rue", "alertes", "equipe"];
const PARTIES = ["signalements", "messages", "non-certifies", "retires", "scanner", ...PARTIES_FONDATEUR];
let partieActive = null;
function aller() {
  let p = location.hash.slice(1);
  if (!PARTIES.includes(p) || (!fondateur && PARTIES_FONDATEUR.includes(p))) p = "signalements";
  partieActive = p;
  PARTIES.forEach((x) => ($(`p-${x}`).hidden = x !== p));
  document.querySelectorAll("#menu [data-partie]").forEach((a) => {
    const actif = a.dataset.partie === p;
    a.classList.toggle("actif", actif);
    if (actif) {
      a.setAttribute("aria-current", "page");
      if (matchMedia("(max-width: 1023px)").matches) a.scrollIntoView({ block: "nearest", inline: "center" });
    } else a.removeAttribute("aria-current");
  });
  charger(p);
}
window.addEventListener("hashchange", () => {
  if (!$("ecran-admin").hidden) {
    aller();
    $("contenu").focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
});
const compteur = (partie, n) => {
  const c = document.querySelector(`[data-n="${partie}"]`);
  if (c) c.textContent = n ? String(n) : "";
};

const CHARGEURS = {};
async function charger(p, { silencieux = false } = {}) {
  const f = CHARGEURS[p];
  if (!f) return;
  try {
    await f(silencieux);
  } catch (err) {
    if (silencieux) return;
    const zone = $(`p-${p}`).querySelector("[data-liste]") ?? $(`p-${p}`);
    zone.append(el("p", { class: "erreur", role: "alert", texte: messageErreur(err) }));
  }
}
const liste = (p) => $(`p-${p}`).querySelector("[data-liste]");

// ---- Signalements ----
let occupe = false;
async function decider(id, titre, decision, apres) {
  if (decision === "retirer" && !(await confirmer("Retirer cet événement ?", `« ${titre} » disparaîtra de Lokal pour tout le monde. Tu pourras le remettre depuis Admin Lokal › Retirés.`, "Retirer"))) return;
  if (occupe) return;
  occupe = true;
  try {
    const { error } = await sb().rpc("admin_decider", { ev: id, decision });
    if (error) throw error;
    toast(decision === "retirer" ? "Événement retiré de Lokal" : decision === "garder" ? "Gardé · l'événement reste visible" : "Événement remis sur Lokal");
    apres?.();
    charger("signalements", { silencieux: partieActive !== "signalements" });
    charger("retires", { silencieux: partieActive !== "retires" });
  } catch (err) {
    toast(messageErreur(err));
  } finally {
    occupe = false;
  }
}

// Le type, l'organisateur et l'origine des événements signalés (les admins peuvent tout lire).
async function details(ids) {
  if (!ids.length) return new Map();
  const { data } = await sb().from("evenements").select("id,categorie,organisateur,certifie,source").in("id", ids);
  return new Map((data ?? []).map((d) => [d.id, d]));
}
const origine = (d) => (d ? (d.certifie ? `${d.organisateur} · certifié` : texteOrigine(d.source)) : "");

CHARGEURS.signalements = async (silencieux) => {
  const { data, error } = await sb().rpc("admin_signalements");
  if (error) throw error;
  const l = data ?? [];
  compteur("signalements", l.length);
  $("t-sig").textContent = `Signalements (${l.length})`;
  if (silencieux && partieActive !== "signalements") return;
  const d = await details(l.map((s) => s.evenement)).catch(() => new Map());
  const zone = liste("signalements");
  if (!l.length) return vider(zone, vide("Aucun signalement."));
  vider(
    zone,
    ...l.map((s) => {
      const infos = d.get(s.evenement);
      const commentaires = s.commentaires ?? [];
      const masque = s.visibilite === "masque";
      return el(
        "article",
        { class: "bloc" },
        el("div", { class: "ligne-titre" }, icone(infos?.categorie ?? "autre"), el("div", {}, el("h2", { texte: s.titre }), el("span", { class: "detail", texte: [formatJour(s.date_debut), s.village, origine(infos)].filter(Boolean).join(" · ") }))),
        el("div", { class: "pills" }, el("span", { class: masque ? "pastille alerte" : "pastille", texte: `${pluriel(s.nb_comptes, "signalement")} sur ${SIGNALEMENTS_POUR_MASQUER}${s.nb > s.nb_comptes ? ` (+ ${s.nb - s.nb_comptes} d'invités)` : ""} · ${masque ? "masqué en attendant ta décision" : "encore visible"}` })),
        (s.motifs ?? []).length ? el("p", { class: "detail", texte: s.motifs.map(texteMotif).join(" · ") }) : null,
        commentaires.slice(0, 5).map((t) => el("p", { class: "citation", texte: `« ${t} »` })),
        commentaires.length > 5 ? el("p", { class: "detail", texte: `+ ${commentaires.length - 5} autre${commentaires.length > 6 ? "s" : ""} commentaire${commentaires.length > 6 ? "s" : ""}` }) : null,
        el(
          "div",
          { class: "actions" },
          el("button", { class: "btn danger petit", type: "button", texte: "Retirer", onclick: () => decider(s.evenement, s.titre, "retirer") }),
          el("button", { class: "btn sec petit", type: "button", texte: "Garder", onclick: () => decider(s.evenement, s.titre, "garder") }),
          el("button", { class: "btn sec petit", type: "button", texte: "Voir", onclick: () => voir(s.evenement) }),
        ),
      );
    }),
  );
};

// ---- Messages signalés ----
CHARGEURS.messages = async (silencieux) => {
  const { data, error } = await sb().rpc("admin_messages_signales");
  if (error) throw error;
  const l = data ?? [];
  compteur("messages", l.length);
  $("t-msg").textContent = `Messages signalés (${l.length})`;
  if (silencieux && partieActive !== "messages") return;
  const zone = liste("messages");
  if (!l.length) return vider(zone, vide("Aucun message signalé."));
  const deciderMsg = async (m, decision) => {
    if (occupe) return;
    occupe = true;
    try {
      const { error: e } = await sb().rpc("admin_decider_message", { msg: m.message, decision });
      if (e) throw e;
      toast(decision === "retirer" ? "Message retiré" : "Gardé · le message reste");
      charger("messages");
    } catch (err) {
      toast(messageErreur(err));
    } finally {
      occupe = false;
    }
  };
  vider(
    zone,
    ...l.map((m) =>
      el(
        "article",
        { class: "bloc" },
        el("p", { class: "citation", texte: `« ${m.texte} »` }),
        el("p", { class: "detail", texte: `De ${m.auteur_nom} · à propos de « ${m.titre} » · ${pluriel(m.nb, "signalement")}` }),
        el(
          "div",
          { class: "actions" },
          el("button", { class: "btn danger petit", type: "button", texte: "Retirer le message", onclick: () => deciderMsg(m, "retirer") }),
          el("button", { class: "btn sec petit", type: "button", texte: "Garder", onclick: () => deciderMsg(m, "garder") }),
        ),
      ),
    ),
  );
};

// ---- Non certifiés ----
const LIMITE_NON_CERTIFIES = 500;
const PAQUET = 30;
let nonCertifies = null;
let ncVisibles = PAQUET;
let ncOrigine = "";
function afficherNonCertifies() {
  const tous = filtrerNonCertifies(nonCertifies ?? [], $("nc-q").value, ncOrigine);
  const corps = $("nc");
  if (!tous.length) {
    vider(corps, el("tr", {}, el("td", { colspan: 6, class: "detail", texte: nonCertifies?.length ? "Rien ne correspond à ta recherche." : "Aucun événement non certifié à venir." })));
  } else {
    vider(
      corps,
      ...tous.slice(0, ncVisibles).map((e) =>
        el(
          "tr",
          {},
          el("td", {}, el("span", { class: "titre-ev" }, icone(e.categorie, true), e.titre)),
          el("td", { "data-t": "Organisateur", texte: e.organisateur }),
          el("td", { "data-t": "Date", texte: formatJour(e.date) }),
          el("td", { "data-t": "Village", texte: e.village }),
          el("td", { "data-t": "Origine", texte: texteOrigine(e.source) }),
          el("td", {}, el("button", { class: "btn sec petit", type: "button", texte: "Voir", onclick: () => voir(e.id) })),
        ),
      ),
    );
  }
  $("nc-plus").hidden = tous.length <= ncVisibles;
}
CHARGEURS["non-certifies"] = async () => {
  if (!nonCertifies) vider($("nc"), el("tr", {}, el("td", { colspan: 6, class: "detail", texte: "Chargement…" })));
  const auj = aujourdhuiBelgique();
  const { data, error } = await sb()
    .from("evenements")
    .select(COLONNES)
    .eq("certifie", false)
    .eq("visibilite", "visible")
    .neq("source", "agenda") // les dates des agendas des communes ont leur propre suivi (Imports)
    .or(`date_fin.gte.${auj},and(date_fin.is.null,date_debut.gte.${auj})`)
    .order("date_debut")
    .order("heure_debut")
    .limit(LIMITE_NON_CERTIFIES);
  if (error) throw error;
  nonCertifies = (data ?? []).map(depuisLigne);
  const n = nonCertifies.length;
  compteur("non-certifies", n >= LIMITE_NON_CERTIFIES ? `${LIMITE_NON_CERTIFIES}+` : n);
  $("t-nc").textContent = `Événements non certifiés (${n >= LIMITE_NON_CERTIFIES ? `${LIMITE_NON_CERTIFIES} et plus` : n})`;
  afficherNonCertifies();
};
$("nc-q").addEventListener("input", () => ((ncVisibles = PAQUET), afficherNonCertifies()));
document.querySelectorAll("[data-origine]").forEach((b) =>
  b.addEventListener("click", () => {
    ncOrigine = b.dataset.origine;
    document.querySelectorAll("[data-origine]").forEach((x) => {
      x.classList.toggle("actif", x === b);
      x.setAttribute("aria-pressed", String(x === b));
    });
    ncVisibles = PAQUET;
    afficherNonCertifies();
  }),
);
$("nc-plus").addEventListener("click", () => ((ncVisibles += PAQUET), afficherNonCertifies()));

// ---- Retirés ----
CHARGEURS.retires = async (silencieux) => {
  const { data, error } = await sb().rpc("admin_retires");
  if (error) throw error;
  const l = data ?? [];
  compteur("retires", l.length);
  $("t-ret").textContent = `Retirés (${l.length})`;
  if (silencieux && partieActive !== "retires") return;
  const d = await details(l.map((r) => r.evenement)).catch(() => new Map());
  if (!l.length) return vider($("ret"), el("tr", {}, el("td", { colspan: 5, class: "detail", texte: "Aucun événement retiré." })));
  vider(
    $("ret"),
    ...l.map((r) =>
      el(
        "tr",
        {},
        el(
          "td",
          {},
          el("span", { class: "titre-ev" }, icone(d.get(r.evenement)?.categorie ?? "autre", true), r.titre),
          r.note ? el("p", { class: "note-retrait", texte: `Note : « ${r.note} »` }) : null,
        ),
        el("td", { "data-t": "Organisateur", texte: r.organisateur }),
        el("td", { "data-t": "Date", texte: `${formatJour(r.date_debut)} · ${r.village}` }),
        el("td", { "data-t": "Retiré le", texte: [r.retire_le ? jourCourt(r.retire_le) : "—", r.nb ? pluriel(r.nb, "signalement") : ""].filter(Boolean).join(" · ") }),
        el(
          "td",
          {},
          el(
            "div",
            { class: "actions" },
            el("button", { class: "btn sec petit", type: "button", texte: "Remettre", onclick: () => decider(r.evenement, r.titre, "remettre") }),
            el("button", { class: "btn sec petit", type: "button", texte: "Voir", onclick: () => voir(r.evenement) }),
            el("button", { class: "btn sec petit", type: "button", texte: r.note ? "Modifier la note" : "Ajouter une note", onclick: () => noterRetrait(r) }),
          ),
        ),
      ),
    ),
  );
};

// Note de l'équipe sur un retrait (demande d'Arnaud du 24 nov. 2026), visible seulement par l'équipe Lokal.
const NOTE_MAX = 200;
function noterRetrait(r) {
  const champ = el("textarea", { class: "champ", rows: 3, maxlength: NOTE_MAX, placeholder: "Par exemple : ne correspond pas", "aria-label": "Note" });
  champ.value = r.note ?? "";
  const erreur = el("p", { class: "erreur", role: "alert", hidden: true });
  const enregistrer = el("button", {
    class: "btn petit",
    type: "button",
    texte: "Enregistrer",
    onclick: async () => {
      enregistrer.disabled = true;
      erreur.hidden = true;
      try {
        const { error } = await sb().rpc("admin_noter_retrait", { ev: r.evenement, note: champ.value.trim().slice(0, NOTE_MAX) });
        if (error) throw error;
        fenetre.close();
        toast(champ.value.trim() ? "Note enregistrée" : "Note effacée");
        charger("retires");
      } catch (err) {
        erreur.textContent = messageErreur(err);
        erreur.hidden = false;
        enregistrer.disabled = false;
      }
    },
  });
  vider(
    corpsFenetre,
    el("h2", { id: "f-titre", texte: "Note sur ce retrait" }),
    el("p", { class: "detail", texte: `« ${r.titre} » · ${formatJour(r.date_debut)} · ${r.village}` }),
    champ,
    el("p", { class: "note", texte: `Visible seulement par l'équipe Lokal, pas par l'organisateur. ${NOTE_MAX} caractères au plus. Laisse vide pour effacer la note.` }),
    erreur,
    el("div", { class: "actions" }, enregistrer, el("button", { class: "btn sec petit", type: "button", texte: "Annuler", onclick: () => fenetre.close() })),
  );
  fermerFenetre.hidden = true;
  fenetre.addEventListener("close", () => (fermerFenetre.hidden = false), { once: true });
  fenetre.showModal();
  champ.focus();
}

// ---- Ajouter un événement : photos, lien d'une page ou texte (comme l'appli, mode équipe Lokal) ----
// Plusieurs photos à la fois (demande d'Arnaud du 24 nov. 2026) : lues l'une après l'autre,
// chaque photo a sa propre case de résultat, vérifiée et publiée séparément. Pas de « Tout publier ».
const MAX_PHOTOS = 10;
let lot = null; // { groupes: [{ nom, etat, message, prets, mauvaise, source, publies, noeud }], enCours }
// Le message reste visible : la page défile jusqu'à lui (sinon il peut être caché sous les blocs, bug du 26 nov.).
const erreurScan = (t) => {
  $("erreur-scan").textContent = t;
  $("erreur-scan").hidden = !t;
  if (t) $("erreur-scan").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
};
const resultat = $("resultat-scan");
// Le résultat s'affiche sous le bloc utilisé (demande d'Arnaud du 26 nov. 2026) : sous « Lire la page d'un lien »
// pour un lien, sous les blocs photos et texte pour le reste. Même logique sur chaque écran.
function placerResultat(apres) {
  if (resultat.previousElementSibling !== apres) apres.after(resultat);
}

async function lirePhoto(fichier) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("image"));
      i.src = url;
    });
    const t = tailleScan(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = t.l;
    canvas.height = t.h;
    canvas.getContext("2d").drawImage(img, 0, 0, t.l, t.h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
const versBlob = (canvas, qualite) => new Promise((ok) => canvas.toBlob((b) => ok(b), "image/jpeg", qualite));
async function recadrer(canvas, cadre) {
  const c = cadrePixels(cadre, canvas.width, canvas.height);
  if (!c) return versBlob(canvas, 0.85);
  const morceau = document.createElement("canvas");
  morceau.width = c.l;
  morceau.height = c.h;
  morceau.getContext("2d").drawImage(canvas, c.x, c.y, c.l, c.h, 0, 0, c.l, c.h);
  return versBlob(morceau, 0.85);
}

// La lecture par le serveur (fonction « lire-affiche ») : seulement les 3 en-têtes qu'elle accepte.
async function lire(corps) {
  const { data } = await sb().auth.getSession();
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/lire-affiche`, {
      method: "POST",
      headers: { authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: SUPABASE_CLE, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });
  } catch {
    throw { scan: "reseau" };
  }
  if (!r.ok) {
    let code = "";
    try {
      code = (await r.json()).erreur ?? "";
    } catch {
      code = "";
    }
    throw { scan: ["limite", "pas_de_cle", "occupe", "admin", "lien", "reseau_social", "page"].includes(code) ? code : "lecture" };
  }
  return r.json();
}

async function evenementsEntre(debut, fin) {
  const { data, error } = await sb()
    .from("evenements")
    .select(COLONNES)
    .eq("visibilite", "visible")
    .lte("date_debut", fin)
    .or(`date_fin.gte.${debut},and(date_fin.is.null,date_debut.gte.${debut})`)
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map(depuisLigne);
}

function liberer(g) {
  g.prets?.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  g.prets = null;
}
function fermerResultat() {
  lot?.groupes.forEach(liberer);
  lot = null;
  resultat.hidden = true;
  vider(resultat);
}

// Prépare les événements lus : retourne ce qui s'affiche dans la case de la photo (ou du texte).
async function traiter(g, lecture, canvas) {
  const photo = !!canvas;
  if (lecture.choquant) return Object.assign(g, { etat: "erreur", message: photo ? "Affiche refusée : contenu choquant" : "Texte refusé : contenu choquant" });
  const auj = aujourdhuiBelgique();
  const tous = versBrouillons(lecture, auj).filter((b) => b.date);
  if (!lecture.affiche || !tous.length) return Object.assign(g, { etat: "erreur", message: photo ? "Aucun événement lisible sur cette photo · essaie plus près, bien à plat" : "Aucun événement trouvé dans ce texte" });
  const etrangers = tous.filter((b) => b.etranger);
  if (etrangers.length) toast(`${etrangers.length > 1 ? `${etrangers.length} événements ignorés : ` : ""}Pour l'instant, l'appli ne propose que la Belgique.`);
  const belges = tous.filter((b) => !b.etranger);
  if (!belges.length) return Object.assign(g, { etat: "erreur", message: "Aucun événement en Belgique sur cette photo" });
  const ls = await chargerLieux();
  const jours = belges.map((b) => b.date).sort();
  const existants = await evenementsEntre(jours[0], jours[jours.length - 1]).catch(() => []);
  const mauvaise = lecture.qualite === "mauvaise";
  const prets = [];
  for (const b of belges) {
    const lieu = trouverLieu(b, ls);
    const doublon = dejaSurLokal(b, existants, lieu);
    // Photo floue ou trop sombre, ou texte : pas de photo, l'appli dessine une affiche dans le style Lokal.
    const blob = mauvaise || !canvas ? null : await recadrer(canvas, b.cadre).catch(() => null);
    prets.push({ b, lieu, blob, url: blob ? URL.createObjectURL(blob) : null, cleCadre: JSON.stringify(b.cadre), doublon, coche: !doublon && !b.passe });
  }
  return Object.assign(g, { etat: "pret", prets, mauvaise });
}

function choisirVillage(g, p, conteneur) {
  const champ = el("input", { class: "champ", type: "search", placeholder: "Le village ou la commune", "aria-label": "Le village ou la commune", autocomplete: "off" });
  const choix = el("div", { class: "filtres-puces" });
  champ.addEventListener("input", async () => {
    const ls = await chargerLieux();
    vider(choix, ...chercherLieux(champ.value, ls, 5).map((l) => el("button", { class: "chip", type: "button", texte: libelleLieu(l), onclick: () => ((p.lieu = l), afficherGroupe(g)) })));
  });
  conteneur.append(el("div", { class: "f" }, el("span", { class: "note", texte: "Lieu pas reconnu : choisis la commune avant de publier." }), champ, choix));
}

// L'en-tête du lot (plusieurs photos seulement) : où en est la lecture.
function afficherEntete() {
  const n = lot.groupes.length;
  if (n < 2) return vider(lot.entete);
  const lues = lot.groupes.filter((g) => !["attente", "lecture"].includes(g.etat)).length;
  vider(
    lot.entete,
    el("p", { class: "kicker", texte: "Résultat du scan" }),
    el("h2", { class: "h-bloc", texte: `${n} photos` }),
    el("p", { class: "note", role: "status", texte: lues < n ? `Lecture de la photo ${lues + 1} sur ${n}… Tu peux déjà vérifier les photos lues.` : "Toutes les photos sont lues. Vérifie chaque événement avant de publier : Claude peut se tromper." }),
  );
}

function afficherGroupe(g) {
  const n = lot.groupes.length;
  const i = lot.groupes.indexOf(g);
  const kicker = n > 1 ? el("p", { class: "kicker" }, `Photo ${i + 1} sur ${n}`, g.nom ? el("span", { class: "detail", texte: ` · ${g.nom}` }) : null) : el("p", { class: "kicker", texte: g.etat === "publie" ? "C'est publié" : "Résultat du scan" });
  const ignorer = (texte = "Ignorer cette photo") => el("button", { class: "btn sec", type: "button", texte: n > 1 ? texte : "Fermer", onclick: () => retirerGroupe(g) });
  if (g.etat === "attente" || g.etat === "lecture") {
    return vider(g.noeud, kicker, el("h2", { class: "h-bloc", texte: g.source.type === "import" ? "Lecture du texte…" : g.etat === "lecture" ? "Lecture du panneau…" : "En attente" }), el("p", { class: "note", texte: g.etat === "lecture" ? "Claude cherche les événements annoncés. Cela prend quelques secondes." : "Cette photo sera lue juste après." }));
  }
  if (g.etat === "erreur") {
    return vider(g.noeud, kicker, el("div", { class: "bandeau danger", role: "alert" }, el("b", { texte: "Pas d'événement à publier" }), el("span", { texte: g.message })), el("div", { class: "actions" }, ignorer("Retirer cette photo")));
  }
  if (g.etat === "publie") {
    const pub = g.publies;
    return vider(
      g.noeud,
      kicker,
      el("h2", { class: "h-bloc", texte: `${pluriel(pub.length, "événement publié", "événements publiés")} · non certifié${pub.length > 1 ? "s" : ""}` }),
      ...pub.map((e) =>
        el("div", { class: "membre" }, el("div", {}, el("span", { class: "titre-ev" }, icone(e.categorie, true), e.titre), el("span", { class: "detail", texte: `${formatJour(e.date_debut)} · ${String(e.heure_debut).slice(0, 5)} · ${e.village}` })), el("button", { class: "btn sec petit", type: "button", texte: "Voir", onclick: () => voir(e.id) })),
      ),
      n > 1 ? null : el("div", { class: "actions" }, el("button", { class: "btn sec", type: "button", texte: "Scanner autre chose", onclick: fermerResultat })),
    );
  }
  const { prets, mauvaise, source } = g;
  const depuisTexte = source.type === "import";
  const nb = prets.length;
  const aPublier = prets.filter((p) => p.coche && !p.doublon && !p.b.passe);
  const ligne = (t, v) => el("p", { class: "ligne-lue" }, el("span", { class: "detail", texte: `${t} : ` }), v);
  const publier = el("button", { class: "btn", type: "button", texte: "Publier la sélection", onclick: () => publierScan(g, publier) });
  vider(
    g.noeud,
    kicker,
    el("h2", { class: "h-bloc", texte: depuisTexte ? `${nb} événement${nb > 1 ? "s" : ""} trouvé${nb > 1 ? "s" : ""}` : `${nb} affiche${nb > 1 ? "s" : ""} trouvée${nb > 1 ? "s" : ""}` }),
    el("p", { class: "note", texte: `Source : ${source.nom ?? (depuisTexte ? "texte collé" : "photo")}.${depuisTexte ? " Chaque événement aura une fiche dans le style Lokal à la place d'une photo d'affiche." : ""}` }),
    mauvaise ? el("p", { class: "note" }, el("b", { texte: "Photo peu lisible : " }), "on affiche une reproduction de l'affiche dans le style Lokal à la place.") : null,
    ...prets.map((p) => {
      const b = p.b;
      const corps = el(
        "div",
        { class: "lu" },
        el("b", { class: "lu-titre", texte: b.titre }),
        b.passe
          ? el("div", { class: "bandeau danger" }, el("b", { texte: "Date passée" }), el("span", { texte: "Cet événement est déjà passé : il ne sera pas ajouté à la carte." }))
          : p.doublon
            ? el("div", { class: "bandeau" }, el("b", { texte: "Déjà sur Lokal" }), el("span", { texte: "Ton scan confirme l'événement. Il n'est pas publié une deuxième fois." }), el("button", { class: "btn sec petit", type: "button", texte: "Voir l'événement", onclick: () => voir(p.doublon.id) }))
            : null,
        // L'affiche à côté de ce qui a été lu (l'une sous l'autre quand la place manque), pour comparer.
        el(
          "div",
          { class: "lu-corps" },
          p.url ? el("img", { class: "vignette", src: p.url, alt: "L'affiche recadrée" }) : null,
          el(
            "div",
            { class: "lu-infos" },
            ligne("Date", b.dateFin ? `Du ${formatJour(b.date)} au ${formatJour(b.dateFin)}` : formatJour(b.date)),
            ligne("Heure", b.heureFin ? `${b.heure} → ${b.heureFin}` : b.heure),
            ligne("Lieu", [b.lieu, p.lieu ? libelleLieu(p.lieu) : b.village || "à préciser"].filter(Boolean).join(", ")),
            ligne("Organisateur", b.organisateur),
            b.prixTexte ? ligne("Prix", b.prixTexte) : null,
            ligne("Mail", b.email || "aucun sur l'affiche"),
            b.description ? ligne("Infos", b.description) : null,
            b.resume ? el("p", { class: "note", texte: "Résumé de l'affiche en quelques lignes. Une fois certifié, l'organisateur pourra mettre son texte complet." }) : null,
          ),
        ),
      );
      if (!b.passe && !p.doublon && !p.lieu) choisirVillage(g, p, corps);
      const caseP = !b.passe && !p.doublon
        ? el("input", { type: "checkbox", checked: p.coche, "aria-label": `Publier « ${b.titre} »`, onchange: (e) => ((p.coche = e.target.checked), afficherGroupe(g)) })
        : el("span");
      return el("article", { class: "brouillon" }, caseP, corps);
    }),
    el("div", { class: "pills" }, ["Aucun contenu choquant", ...(prets.every((p) => !p.b.passe) ? ["Date à venir"] : []), ...(depuisTexte ? [] : ["Photo recadrée sur l'affiche"])].map((t) => el("span", { class: "pastille", texte: `✓ ${t}` }))),
    el("p", { class: "note", texte: "Ces infos viennent de l'affiche et ne peuvent pas être modifiées. Lu par Claude : vérifie avant de publier. En cas d'erreur, ne publie pas et réessaie." }),
    el("div", { class: "actions" }, aPublier.length ? publier : null, n > 1 ? ignorer() : el("button", { class: "btn sec", type: "button", texte: aPublier.length ? "Annuler" : "Fermer", onclick: fermerResultat })),
  );
}

function retirerGroupe(g) {
  liberer(g);
  lot.groupes = lot.groupes.filter((x) => x !== g);
  g.noeud.remove();
  if (!lot.groupes.length) return fermerResultat();
  afficherEntete();
  lot.groupes.forEach(afficherGroupe); // les numéros « Photo 2 sur 3 » changent
  afficherPied();
}

function afficherPied() {
  vider(lot.pied, lot.groupes.length > 1 && !lot.enCours ? el("div", { class: "actions" }, el("button", { class: "btn sec", type: "button", texte: "Tout fermer", onclick: fermerResultat })) : null);
}

// Ouvre un nouveau lot de photos (ou un texte) dans la zone de résultat.
function nouveauLot(groupes) {
  fermerResultat();
  erreurScan("");
  $("erreur-lien").hidden = true;
  lot = { groupes, enCours: true, entete: el("div", { class: "champs" }), pied: el("div") };
  for (const g of groupes) g.noeud = el("section", { class: "groupe-scan champs" });
  resultat.hidden = false;
  vider(resultat, lot.entete, ...groupes.map((g) => g.noeud), lot.pied);
  afficherEntete();
  groupes.forEach(afficherGroupe);
  afficherPied();
  resultat.scrollIntoView({ block: "nearest" });
}
function finLot() {
  if (!lot) return;
  lot.enCours = false;
  afficherEntete();
  afficherPied();
}

async function publierScan(g, bouton) {
  const aPublier = g.prets.filter((p) => p.coche && !p.doublon && !p.b.passe);
  const sansLieu = aPublier.find((p) => !p.lieu);
  if (sansLieu) return toast(`Choisis d'abord la commune de « ${sansLieu.b.titre} »`);
  bouton.disabled = true;
  bouton.setAttribute("aria-busy", "true");
  bouton.textContent = "Publication…";
  const publies = [];
  try {
    const { data: s } = await sb().auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) throw new Error("Pas de session");
    const ls = await chargerLieux();
    const photos = {}; // une même affiche à plusieurs dates : une seule photo
    const salles = {}; // une même salle : une seule recherche
    for (const p of aPublier) {
      const lieu = p.lieu;
      let b = p.b;
      // La position vient de l'adresse. Sans rue mais avec le nom de la salle : on cherche la salle. Sinon le centre du village.
      let pos = lieu;
      if (b.rue) pos = (await positionDepuisAdresse({ village: lieu.nom, rue: b.rue, numero: b.numero, codePostal: b.codePostal }, ls)) ?? lieu;
      else if (b.lieu) {
        const cle = `${b.lieu}|${lieu.nom}`;
        if (!(cle in salles)) salles[cle] = await adresseDuLieu(b.lieu, lieu);
        const t = salles[cle];
        if (t) {
          pos = t;
          b = { ...b, rue: t.rue, numero: t.numero, codePostal: b.codePostal || t.codePostal };
        }
      }
      let chemin = null;
      if (p.blob) {
        if (!(p.cleCadre in photos)) {
          const c = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const up = await sb().storage.from("affiches").upload(c, p.blob, { contentType: "image/jpeg", upsert: false });
          if (up.error) throw up.error;
          photos[p.cleCadre] = c;
        }
        chemin = photos[p.cleCadre];
      }
      const ligne = versLigne({
        organisateur: b.organisateur, titre: b.titre, categorie: b.categorie, date: b.date, dateFin: b.dateFin, heure: b.heure, heureFin: b.heureFin,
        village: lieu.nom, lieu: b.lieu, rue: b.rue, numero: b.numero, codePostal: b.codePostal, lat: pos.lat, lng: pos.lng,
        description: b.description, prix: b.prix, photo: chemin,
      });
      const { data, error } = await sb()
        .from("evenements")
        .insert({ ...ligne, source: g.source.type, source_url: g.source.url, source_nom: g.source.nom })
        .select("id,titre,categorie,date_debut,heure_debut,village")
        .single();
      if (error) throw error;
      publies.push(data);
      p.publie = true;
    }
  } catch (err) {
    toast(messageErreur(err));
    if (!publies.length) {
      bouton.disabled = false;
      bouton.removeAttribute("aria-busy");
      bouton.textContent = "Publier la sélection";
      return;
    }
  }
  nonCertifies = null;
  if (!lot?.groupes.includes(g)) return;
  liberer(g);
  Object.assign(g, { etat: "publie", publies });
  afficherGroupe(g);
}

// Lit les photos l'une après l'autre. Plafond de scans atteint : les photos restantes ne sont pas envoyées.
async function scannerPhotos(liste) {
  if (lot?.enCours) return toast("Attends la fin de la lecture en cours");
  const fichiers = [...(liste ?? [])];
  if (!fichiers.length) return;
  placerResultat($("erreur-scan"));
  const bonnes = fichiers.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
  if (!bonnes.length) return erreurScan(fichiers.length > 1 ? "Choisis des photos (JPEG, PNG ou WebP)." : "Choisis une photo (JPEG, PNG ou WebP).");
  const lien = $("lien-photo").value.trim();
  if (lien && !lienSourceValide(lien)) return erreurScan("Le lien doit commencer par https://");
  const ecartees = fichiers.length - bonnes.length;
  if (ecartees) toast(`${pluriel(ecartees, "fichier ignoré", "fichiers ignorés")} : ce n'est pas une photo JPEG, PNG ou WebP`);
  if (bonnes.length > MAX_PHOTOS) toast(`${MAX_PHOTOS} photos au maximum à la fois : les ${MAX_PHOTOS} premières sont lues`);
  const source = { type: "affiche", url: lien || null, nom: lien ? nomSource(lien) : null };
  const groupes = bonnes.slice(0, MAX_PHOTOS).map((f) => ({ fichier: f, nom: bonnes.length > 1 ? f.name.slice(0, 60) : "", etat: "attente", source }));
  nouveauLot(groupes);
  const monLot = lot;
  let arret = null;
  for (const g of groupes) {
    if (lot !== monLot) return; // tout fermé pendant la lecture
    if (!monLot.groupes.includes(g)) continue; // photo retirée entre-temps
    if (arret) {
      Object.assign(g, { etat: "erreur", message: arret });
      afficherGroupe(g);
      continue;
    }
    g.etat = "lecture";
    afficherGroupe(g);
    try {
      const canvas = await lirePhoto(g.fichier);
      const base64 = (await new Promise((ok) => {
        const r = new FileReader();
        versBlob(canvas, 0.8).then((b) => {
          r.onload = () => ok(String(r.result));
          r.readAsDataURL(b);
        });
      })).split(",")[1];
      const lecture = await lire({ image: base64, aujourdhui: aujourdhuiBelgique() });
      await traiter(g, lecture, canvas);
    } catch (err) {
      const message = err?.scan ? messageScan(err.scan) : err?.message === "image" ? "Cette photo ne s'ouvre pas." : messageErreur(err);
      if (err?.scan === "limite" || err?.scan === "pas_de_cle") arret = message;
      Object.assign(g, { etat: "erreur", message });
    }
    g.fichier = null;
    if (lot !== monLot) return liberer(g);
    if (monLot.groupes.includes(g)) afficherGroupe(g);
    else liberer(g);
    afficherEntete();
  }
  finLot();
}
$("fichier-scan").addEventListener("change", (e) => {
  scannerPhotos(e.target.files);
  e.target.value = "";
});
const depot = $("depot-scan");
["dragenter", "dragover"].forEach((t) => depot.addEventListener(t, (e) => (e.preventDefault(), depot.classList.add("survol"))));
["dragleave", "drop"].forEach((t) => depot.addEventListener(t, () => depot.classList.remove("survol")));
depot.addEventListener("drop", (e) => {
  e.preventDefault();
  scannerPhotos(e.dataTransfer?.files);
});
// Un texte collé ou le lien d'une page : même lecture, même résultat (un lien seul se lit comme une page).
async function lireTexteOuLien(n) {
  const g = { nom: "", etat: "lecture", source: n.lien ? { type: "import", url: n.lien, nom: nomSource(n.lien) } : { type: "import", url: null, nom: null } };
  nouveauLot([g]);
  const monLot = lot;
  const auj = aujourdhuiBelgique();
  try {
    const lecture = await lire(n.lien ? { lien: n.lien, aujourdhui: auj } : { texte: n.texte, aujourdhui: auj });
    await traiter(g, lecture, null);
  } catch (err) {
    Object.assign(g, { etat: "erreur", message: err?.scan ? messageScan(err.scan) : messageErreur(err) });
  }
  if (lot !== monLot) return liberer(g);
  afficherGroupe(g);
  finLot();
}
$("f-texte").addEventListener("submit", (e) => {
  e.preventDefault();
  if (lot?.enCours) return toast("Attends la fin de la lecture en cours");
  const n = natureTexte(e.target.texte.value);
  if (n.erreur) return erreurScan(n.erreur);
  placerResultat($("erreur-scan"));
  return lireTexteOuLien(n);
});
$("f-lien").addEventListener("submit", (e) => {
  e.preventDefault();
  if (lot?.enCours) return toast("Attends la fin de la lecture en cours");
  const n = natureLien(e.target.lien.value);
  // Le message s'affiche juste sous le bouton (bug du 26 nov. : il arrivait plus bas, hors de l'écran).
  $("erreur-lien").textContent = n.erreur ?? "";
  $("erreur-lien").hidden = !n.erreur;
  if (n.erreur) return;
  placerResultat($("f-lien"));
  return lireTexteOuLien(n);
});

// ---- Fondateur : statistiques ----
CHARGEURS.stats = async () => {
  const zone = liste("stats");
  vider(zone, el("p", { class: "note", texte: "Chargement…" }));
  const { data, error } = await sb().rpc("fondateur_statistiques");
  if (error) throw error;
  const s = data ?? {};
  vider(
    zone,
    ...LIGNES_STATS.flatMap(([groupe, lignes]) => [
      el("p", { class: "groupe-titre", texte: groupe }),
      el("div", { class: "chiffres" }, lignes.map(([cle, nom]) => el("div", { class: "chiffre" }, el("b", { texte: formatNombre(s[cle] ?? 0) }), el("span", { texte: nom })))),
    ]),
    el("div", { class: "actions" }, el("button", { class: "btn sec petit", type: "button", texte: "Actualiser", onclick: () => charger("stats") })),
  );
};

// ---- Fondateur : quand Lokal sert le plus (une seule série par graphique : une couleur, pas de légende) ----
const bulle = $("bulle");
function barres(zone, valeurs, etiquette) {
  const max = Math.max(1, ...valeurs);
  vider(
    zone,
    ...valeurs.map((v, i) => {
      const texte = etiquette(i, v);
      const b = el("div", { class: "b", tabindex: 0, "aria-label": texte }, el("i"));
      b.firstChild.style.height = `${Math.max(1, (v / max) * 100)}%`;
      const montrerBulle = () => {
        const r = b.getBoundingClientRect();
        bulle.textContent = texte;
        bulle.hidden = false;
        // Toujours entière dans l'écran, même au bord du téléphone.
        const demi = bulle.offsetWidth / 2;
        const x = Math.min(Math.max(r.left + r.width / 2, demi + 8), innerWidth - demi - 8);
        bulle.style.left = `${x}px`;
        bulle.style.top = `${r.top + r.height * (1 - v / max) - 4}px`;
      };
      b.addEventListener("mouseenter", montrerBulle);
      b.addEventListener("focus", montrerBulle);
      b.addEventListener("mouseleave", () => (bulle.hidden = true));
      b.addEventListener("blur", () => (bulle.hidden = true));
      return b;
    }),
  );
}
window.addEventListener("scroll", () => (bulle.hidden = true), { passive: true });
const fois = (n) => `${formatNombre(n)} ouverture${n > 1 ? "s" : ""}`;
CHARGEURS.usage = async () => {
  const { data, error } = await sb().rpc("fondateur_activite");
  if (error) throw error;
  const a = lireActivite(data);
  const r = resumeActivite(a);
  $("resume-usage").textContent = r
    ? `Le plus d'ouvertures entre ${r.pointe}, le ${r.jour}. La nuit (22 h – 6 h) : ${r.nuit} % des ouvertures.`
    : "Pas encore assez d'ouvertures sur les 4 dernières semaines.";
  barres($("heures"), a.ouverturesHeure, (h, v) => `${h} h – ${(h + 1) % 24} h : ${fois(v)}`);
  vider($("axe-heures"), ...a.ouverturesHeure.map((_, h) => el("span", { texte: String(h) })));
  barres($("jours"), a.ouverturesJour, (j, v) => `${JOURS_COURTS[j]} : ${fois(v)}`);
  vider($("axe-jours"), ...JOURS_COURTS.map((j) => el("span", { texte: j })));
  const parts = partsEcrans(a.ecrans);
  const maxP = Math.max(1, ...parts.map((x) => x.pct));
  vider(
    $("ecrans"),
    ...(parts.length
      ? [
          ...parts.slice(0, 10).map((x) => {
            const barre = el("span", { class: "mini-barre" }, el("i"));
            barre.firstChild.style.width = `${(x.pct / maxP) * 100}%`;
            const ligne = el("div", { class: "ecran-ligne" }, el("span", { texte: NOMS_ECRANS[x.k] ?? x.k }), barre, el("b", { class: "nb", texte: x.texte }));
            ligne.title = `${NOMS_ECRANS[x.k] ?? x.k} : ${x.texte} des vues (${formatNombre(x.v)})`;
            return ligne;
          }),
          el("p", { class: "note", texte: "En % de toutes les vues d'écran des 4 dernières semaines." }),
        ]
      : [el("p", { class: "note", texte: "Pas encore de données." })]),
  );
  const t = el(
    "table",
    { class: "tableau" },
    el("thead", {}, el("tr", {}, el("th", { texte: "Heure" }), el("th", { class: "nb", texte: "Ouvertures" }), el("th", { class: "nb", texte: "Actions" }))),
    el("tbody", {}, a.ouverturesHeure.map((v, h) => el("tr", {}, el("td", { texte: `${h} h – ${(h + 1) % 24} h` }), el("td", { class: "nb", "data-t": "Ouvertures", texte: formatNombre(v) }), el("td", { class: "nb", "data-t": "Actions", texte: formatNombre(a.actionsHeure[h]) })))),
  );
  vider($("table-usage"), t, el("p", { class: "note", texte: "Actions : publier, « J'y vais » ou « Intéressé », messages et scans." }));
};

// ---- Fondateur : imports des agendas ----
CHARGEURS.imports = async () => {
  const zone = liste("imports");
  vider(zone, el("p", { class: "note", texte: "Chargement…" }));
  const auj = aujourdhuiBelgique();
  const [journal, venir] = await Promise.all([
    sb().from("agenda_imports").select("id,mode,debut,fin,ok,erreur,lus,nouveaux,modifies,retires,doublons,ignores").order("debut", { ascending: false }).limit(30),
    sb().from("evenements").select("village").eq("source", "agenda").eq("visibilite", "visible").or(`date_fin.gte.${auj},and(date_fin.is.null,date_debut.gte.${auj})`).limit(5000),
  ]);
  if (journal.error) throw journal.error;
  const l = journal.data ?? [];
  const ls = await chargerLieux().catch(() => []);
  const villages = venir.data ?? [];
  const communes = new Set(villages.map((v) => communeDuVillage(v.village, ls))).size;
  const dernier = l[0];
  const carte = el(
    "div",
    { class: "bloc" },
    el("div", { class: "ligne-titre" }, el("div", {}, el("h2", { texte: "Agendas des communes wallonnes" }), el("span", { class: "detail", texte: "iMio · données ouvertes" }))),
    el(
      "div",
      { class: "pills" },
      dernier ? el("span", { class: dernier.ok === false ? "pastille alerte" : "pastille ok", texte: dernier.ok === false ? "Dernier import en erreur" : "Dernier import réussi" }) : el("span", { class: "pastille", texte: "Aucun import pour l'instant" }),
      dernier ? el("span", { class: "pastille", texte: `Dernier import : ${quand(dernier.debut).toLowerCase()}` }) : null,
    ),
    el("div", { class: "chiffres deux" }, el("div", { class: "chiffre" }, el("b", { texte: venir.error ? "—" : formatNombre(villages.length) }), el("span", { texte: "dates à venir" })), el("div", { class: "chiffre" }, el("b", { texte: venir.error ? "—" : formatNombre(communes) }), el("span", { texte: "communes" }))),
  );
  const table = el(
    "div",
    { class: "bloc tableau-bloc" },
    el(
      "table",
      { class: "tableau" },
      el("thead", {}, el("tr", {}, ["Quand", "Type", "Nouvelles", "Mises à jour", "Retirées", "Résultat"].map((t, i) => el("th", { class: i >= 2 && i <= 4 ? "nb" : null, texte: t })))),
      el(
        "tbody",
        {},
        l.length
          ? l.map((x) =>
              el(
                "tr",
                {},
                el("td", { texte: quand(x.debut) }),
                el("td", { "data-t": "Type", texte: x.mode === "nuit" ? "Nuit (tout l'agenda)" : "Toutes les 2 h (nouveautés)" }),
                el("td", { class: "nb", "data-t": "Nouvelles", texte: formatNombre(x.nouveaux ?? 0) }),
                el("td", { class: "nb", "data-t": "Mises à jour", texte: formatNombre(x.modifies ?? 0) }),
                el("td", { class: "nb", "data-t": "Retirées", texte: formatNombre(x.retires ?? 0) }),
                el(
                  "td",
                  { "data-t": "Résultat" },
                  !x.fin && x.ok == null
                    ? el("span", { class: "pastille", texte: "En cours" })
                    : x.ok === false
                      ? el("span", { class: "pastille alerte", title: x.erreur ?? "", texte: `Erreur${x.erreur ? " : " + String(x.erreur).slice(0, 60) : ""}` })
                      : el("span", { class: "pastille ok", texte: `OK${x.fin ? " · " + dureeImport(x.debut, x.fin) : ""}` }),
                ),
              ),
            )
          : el("tr", {}, el("td", { colspan: 6, class: "detail", texte: "Aucun import pour l'instant." })),
      ),
    ),
  );
  vider(zone, carte, table, el("p", { class: "note", texte: "Les 30 derniers imports. Heures de Belgique." }));
};

// ---- Fondateur : événements sans rue ----
CHARGEURS["sans-rue"] = async () => {
  const zone = liste("sans-rue");
  vider(zone, el("p", { class: "note", texte: "Chargement…" }));
  const [{ data, error }, ls] = await Promise.all([sb().rpc("fondateur_sans_rue"), chargerLieux()]);
  if (error) throw error;
  const lignes = parCommune(data ?? [], (v) => communeDuVillage(v, ls));
  const total = lignes.reduce((x, l) => x + l.total, 0);
  const sans = lignes.reduce((x, l) => x + l.sansRue, 0);
  const top = lignes.filter((l) => l.sansRue > 0).slice(0, 30);
  vider(
    zone,
    el(
      "div",
      { class: "bloc" },
      el("h2", { texte: `${formatNombre(sans)} sur ${formatNombre(total)} événements à venir sont au centre du village (${total ? Math.round((sans / total) * 100) : 0} %).` }),
      el(
        "table",
        { class: "tableau" },
        el("thead", {}, el("tr", {}, el("th", { texte: "Commune" }), el("th", { class: "nb", texte: "Sans rue" }), el("th", { class: "nb", texte: "À venir" }), el("th", { texte: "Part" }))),
        el(
          "tbody",
          {},
          top.length
            ? top.map((l) => {
                const part = Math.round((l.sansRue / l.total) * 100);
                const barre = el("span", { class: "mini-barre" }, el("i"));
                barre.firstChild.style.width = `${part}%`;
                return el("tr", {}, el("td", { texte: l.commune }), el("td", { class: "nb", "data-t": "Sans rue", texte: formatNombre(l.sansRue) }), el("td", { class: "nb", "data-t": "À venir", texte: formatNombre(l.total) }), el("td", { "data-t": "Part" }, el("span", { class: "part" }, barre, `${part} %`)));
              })
            : el("tr", {}, el("td", { colspan: 4, class: "detail", texte: "Tous les événements à venir ont une rue." })),
        ),
      ),
      el("p", { class: "note", texte: "Les 30 communes avec le plus d'événements sans rue." }),
    ),
  );
};

// ---- Fondateur : alertes d'abus ----
CHARGEURS.alertes = async (silencieux) => {
  const { data, error } = await sb().rpc("fondateur_alertes");
  if (error) throw error;
  const l = data ?? [];
  compteur("alertes", l.length);
  $("t-al").textContent = `Alertes d'abus${l.length ? ` (${l.length})` : ""}`;
  if (silencieux && partieActive !== "alertes") return;
  const zone = liste("alertes");
  if (!l.length) return vider(zone, vide("Rien d'anormal sur les 7 derniers jours."));
  vider(zone, ...l.map((a) => el("article", { class: "bloc" }, el("h2", { texte: `${a.qui} · ${a.total} ★ en 7 jours` }), el("p", { class: "detail", texte: detailAlerte(a.detail) }))));
};

// ---- Fondateur : équipe Lokal ----
CHARGEURS.equipe = async () => {
  const zone = $("membres");
  const { data, error } = await sb().rpc("admin_equipe");
  if (error) throw error;
  const l = data ?? [];
  vider(
    zone,
    ...l.map((m) =>
      el(
        "div",
        { class: "membre" },
        el(
          "div",
          {},
          el("b", { texte: m.niveau === "fondateur" ? "Toi · fondateur" : m.statut === "actif" ? m.nom || m.email : m.email }),
          el("span", {
            class: "detail",
            texte: m.niveau === "fondateur"
              ? "accès à tout"
              : m.statut === "actif"
                ? `admin depuis le ${jourCourt(m.depuis)}${m.email && m.nom ? " · " + m.email : ""}`
                : "en attente : sera admin dès sa connexion avec Google ou Facebook",
          }),
        ),
        m.niveau === "admin" ? el("button", { class: "btn danger petit", type: "button", texte: m.statut === "actif" ? "Retirer" : "Annuler", onclick: () => retirerMembre(m) }) : null,
      ),
    ),
  );
};
async function retirerMembre(m) {
  const qui = m.nom || m.email || "cette personne";
  const actif = m.statut === "actif";
  if (!(await confirmer(actif ? "Retirer cet admin ?" : "Annuler l'invitation ?", actif ? `${qui} n'aura plus accès à l'écran Admin.` : `${m.email} ne deviendra pas admin.`, actif ? "Retirer" : "Annuler l'invitation", "Non"))) return;
  try {
    const { error } = await sb().rpc("admin_retirer", actif ? { u: m.utilisateur } : { u: null, adresse: m.email });
    if (error) throw error;
    toast(actif ? "Admin retiré" : "Invitation annulée");
    charger("equipe");
  } catch (err) {
    toast(messageErreur(err));
  }
}
$("f-inviter").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const err = f.querySelector(".erreur");
  const adresse = f.email.value;
  err.hidden = true;
  if (!emailAdminValide(adresse)) {
    err.textContent = "Tape une adresse e-mail complète (par exemple prenom@gmail.com).";
    err.hidden = false;
    return;
  }
  const b = f.querySelector("button");
  b.disabled = true;
  try {
    const { data, error } = await sb().rpc("admin_inviter", { adresse: adresse.trim() });
    if (error) throw error;
    toast(data === "actif" ? "C'est fait : cette personne est admin" : "Invitation en attente : elle sera admin dès sa connexion avec cette adresse");
    f.reset();
    charger("equipe");
  } catch (x) {
    err.textContent = messageErreur(x);
    err.hidden = false;
  } finally {
    b.disabled = false;
  }
});

// ---- Départ : attendre Supabase (chargé juste avant), puis la session ----
function quandPret(f) {
  if (window.supabase?.createClient) return f();
  window.addEventListener("load", f, { once: true });
}
quandPret(() =>
  demarrer().catch(() => {
    montrer("ecran-connexion");
  }),
);
