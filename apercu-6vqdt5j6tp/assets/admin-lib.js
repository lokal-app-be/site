// Admin Lokal sur le site : les règles et les textes de l'écran Admin de l'appli (src/lib/admin.ts, src/lib/scan.ts).
// Fonctions sans écran, testées automatiquement (tests/admin.test.mjs). Toute la sécurité est dans la base :
// chaque fonction « admin_… » ou « fondateur_… » vérifie le rôle de la personne connectée.
import { normaliser, estCategorie, chercherLieux, distanceKm } from "./lokal.js";

export const MOTIFS = [
  { code: "infos_fausses", texte: "Les infos sont fausses ou ont changé" },
  { code: "annule", texte: "Événement annulé" },
  { code: "arnaque", texte: "Arnaque ou faux événement" },
  { code: "choquant", texte: "Contenu choquant ou illégal" },
];
export const texteMotif = (m) => MOTIFS.find((x) => x.code === m)?.texte ?? m;
export const SIGNALEMENTS_POUR_MASQUER = 3;

export const LIGNES_STATS = [
  ["Utilisateurs", [
    ["comptes", "Comptes"], ["comptes_7j", "Nouveaux comptes cette semaine"], ["comptes_mois", "Nouveaux comptes ce mois"],
    ["supprimes_7j", "Comptes supprimés cette semaine"], ["supprimes_mois", "Comptes supprimés ce mois"], ["supprimes_total", "Comptes supprimés en tout"],
    ["invites", "Invités (sans compte)"], ["invites_7j", "Nouveaux invités cette semaine"], ["connectes_7j", "Personnes connectées cette semaine"],
  ]],
  ["Événements", [
    ["evenements_a_venir", "À venir sur la carte"], ["certifies_a_venir", "Dont certifiés"], ["evenements_7j", "Ajoutés cette semaine"],
    ["publies_7j", "Publiés par un organisateur cette semaine"], ["scannes_7j", "Scannés ou importés cette semaine"], ["evenements_total", "En tout depuis le début"],
  ]],
  ["Sorties", [["y_vais", "« J'y vais »"], ["interesse", "« Intéressé »"], ["participations_7j", "Nouveaux choix cette semaine"]]],
  ["Scans d'affiches", [["scans_aujourdhui", "Aujourd'hui"], ["scans_mois", "Ce mois"], ["scans_mois_sonnet", "Dont affiches difficiles (plus chères)"]]],
  ["Amis et messages", [["amities", "Paires d'amis"], ["demandes_attente", "Demandes d'ami en attente"], ["conversations", "Conversations"], ["messages_7j", "Messages cette semaine"]]],
  ["Sécurité", [
    ["signalements_attente", "Événements signalés à traiter"], ["evenements_masques", "Événements masqués (3 signalements)"], ["evenements_retires", "Événements retirés"],
    ["messages_signales_attente", "Messages signalés à traiter"], ["admins", "Admins"], ["invitations", "Invitations en attente"],
  ]],
];
export const formatNombre = (v) => (typeof v === "number" || /^\d+$/.test(String(v)) ? Number(v).toLocaleString("fr-BE") : String(v ?? "—"));

// ---- Quand Lokal sert le plus (compteur anonyme, 4 dernières semaines, heure belge) ----
const nombres = (v, n) => Array.from({ length: n }, (_, i) => Number(v?.[i]) || 0);
export function lireActivite(d) {
  d = d ?? {};
  return {
    ouverturesHeure: nombres(d.ouvertures_heure, 24),
    ouverturesJour: nombres(d.ouvertures_jour, 7),
    actionsHeure: nombres(d.actions_heure, 24),
    ecrans: Object.entries(d.ecrans ?? {}).map(([k, v]) => [k, Number(v) || 0]).sort((a, b) => b[1] - a[1]),
  };
}
// Écrans les plus vus, en % de toutes les vues d'écran (demande d'Arnaud du 25 nov. 2026).
// Arrondi à l'unité ; un écran vu mais sous 1 % affiche « < 1 % » plutôt que 0 %.
export function partsEcrans(ecrans) {
  const total = ecrans.reduce((t, [, v]) => t + v, 0);
  return ecrans.map(([k, v]) => {
    const pct = total ? (v / total) * 100 : 0;
    return { k, v, pct, texte: v > 0 && pct < 1 ? "< 1 %" : `${Math.round(pct)} %` };
  });
}
export const NOMS_ECRANS = {
  carte: "Carte", liste: "Liste", fiche: "Fiche d'un événement", ajouter: "Ajouter / Modifier", scan: "Scanner une affiche",
  profil: "Profil", amis: "Amis", messages: "Messages", notifications: "Notifications", "week-end": "Ce week-end à…",
};
export const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const JOURS_LONGS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const estNuit = (h) => h >= 22 || h < 6;
export function resumeActivite(a) {
  const total = a.ouverturesHeure.reduce((x, y) => x + y, 0);
  if (!total) return null;
  const h = a.ouverturesHeure.indexOf(Math.max(...a.ouverturesHeure));
  const j = a.ouverturesJour.indexOf(Math.max(...a.ouverturesJour));
  const nuit = a.ouverturesHeure.reduce((x, n, i) => x + (estNuit(i) ? n : 0), 0);
  return { pointe: `${h} h – ${(h + 1) % 24} h`, jour: JOURS_LONGS[j], nuit: Math.round((nuit * 100) / total) };
}

// ---- Alertes d'abus ----
export const RAISONS_ETOILES = { parrainage: "parrainages", scan: "scans", presence: "présences", partage: "partages", organiser: "organisateur", photo: "photos" };
export const detailAlerte = (d) =>
  Object.entries(d ?? {}).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n} ★ ${RAISONS_ETOILES[r] ?? r}`).join(" · ");

// ---- Événements sans rue, par commune ----
export function parCommune(lignes, communeDe) {
  const m = new Map();
  for (const l of lignes) {
    const c = communeDe(l.village);
    const x = m.get(c) ?? { commune: c, total: 0, sansRue: 0 };
    x.total += Number(l.total) || 0;
    x.sansRue += Number(l.sans_rue) || 0;
    m.set(c, x);
  }
  return [...m.values()].sort((a, b) => b.sansRue - a.sansRue || a.commune.localeCompare(b.commune, "fr"));
}
// La commune d'un village (liste des villages de Belgique) ; inconnu : le nom tel quel.
export function communeDuVillage(village, lieux) {
  const n = normaliser(String(village).replace(/\s*\(.*\)\s*$/, ""));
  const l = lieux.find((x) => normaliser(x.nom) === n);
  return l ? l.commune : String(village);
}

// ---- Scanner (texte, lien ou photo) : les brouillons, comme l'appli ----
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const coupe = (s, n) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const BELGIQUE = /^(be|bel|belgique|belgium|belgie|belgië)$/i;
export const TEXTE_MIN = 20;
export const TEXTE_MAX = 6000;
export const lienSourceValide = (u) => u.trim().length <= 300 && /^https?:\/\/[^\s]+$/.test(u.trim());
export function nomSource(u) {
  const t = u.trim();
  if (/facebook\.com|fb\.com|fb\.me/i.test(t)) return "Facebook";
  if (/instagram\.com/i.test(t)) return "Instagram";
  return (t.replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0] || "un texte en ligne").slice(0, 40);
}

export function lirePrixTexte(t) {
  const res = [];
  for (const morceau of t.split(/[;/\n]|,(?!\d)| - |\bet\b/i)) {
    const m = morceau.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros?)/i) ?? morceau.match(/(?:€|eur)\s*(\d+(?:[.,]\d{1,2})?)/i);
    if (!m) continue;
    const montant = Number(m[1].replace(",", "."));
    if (!Number.isFinite(montant) || montant < 0 || montant > 999) continue;
    let nom = morceau.replace(m[0], "").replace(/[:()]/g, " ").replace(/\s+/g, " ").trim();
    nom = nom ? nom.charAt(0).toUpperCase() + nom.slice(1) : "Entrée";
    res.push({ nom: nom.slice(0, 30), montant });
  }
  return res.slice(0, 6);
}

export function versBrouillons(l, aujourdhui) {
  return (l?.evenements ?? []).map((x, i) => {
    const date = DATE.test(x.date) ? x.date : "";
    const dateFin = DATE.test(x.date_fin) && x.date_fin > date ? x.date_fin : null;
    const pays = coupe(x.pays, 20);
    const prixTexte = coupe(x.prix, 120);
    return {
      cle: `${i}-${normaliser(x.titre || "").replace(/[^a-z0-9]+/g, "-")}-${date}`,
      titre: coupe(x.titre, 60),
      categorie: estCategorie(x.categorie) ? x.categorie : "autre",
      date, dateFin,
      heure: HEURE.test(x.heure) ? x.heure : "20:00",
      heureFin: HEURE.test(x.heure_fin) ? x.heure_fin : null,
      lieu: coupe(x.lieu, 50), rue: coupe(x.rue, 60), numero: coupe(x.numero, 8),
      codePostal: /^\d{4}$/.test(x.code_postal?.trim() ?? "") ? x.code_postal.trim() : "",
      village: coupe(x.village, 40), commune: coupe(x.commune, 40),
      organisateur: coupe(x.organisateur, 60) || "Organisateur inconnu",
      email: coupe(x.email, 80),
      prixTexte, prix: lirePrixTexte(prixTexte),
      description: coupe(x.description, 2000),
      resume: !!x.resume,
      cadre: Array.isArray(x.cadre) ? x.cadre : [],
      etranger: !!pays && !BELGIQUE.test(pays),
      passe: !date || (dateFin ?? date) < aujourdhui,
    };
  });
}

// L'affiche seule, découpée dans la photo d'après le cadre lu par Claude : [gauche, haut, droite, bas] de 0 à 1.
export function cadreValide(c) {
  return (
    Array.isArray(c) && c.length === 4 && c.every((v) => typeof v === "number" && v >= 0 && v <= 1) &&
    c[2] > c[0] && c[3] > c[1] && (c[2] - c[0]) * (c[3] - c[1]) > 0.03
  );
}
// Le cadre en pixels ; null : toute la photo (pas de cadre, ou le cadre couvre déjà toute la photo).
export function cadrePixels(c, largeur, hauteur) {
  if (!cadreValide(c) || (c[0] < 0.02 && c[1] < 0.02 && c[2] > 0.98 && c[3] > 0.98)) return null;
  return { x: Math.round(c[0] * largeur), y: Math.round(c[1] * hauteur), l: Math.round((c[2] - c[0]) * largeur), h: Math.round((c[3] - c[1]) * hauteur) };
}
// Le côté le plus long de la photo envoyée à la lecture (comme l'appli).
export const COTE_MAX = 1600;
export function tailleScan(l, h, max = COTE_MAX) {
  if (Math.max(l, h) <= max) return { l, h };
  return l >= h ? { l: max, h: Math.round((h * max) / l) } : { l: Math.round((l * max) / h), h: max };
}

// Le texte collé : un lien seul (https://…) se lit comme une page ; sinon c'est un texte.
export function natureTexte(t) {
  const v = t.trim();
  if (/^https?:\/\/\S+$/i.test(v)) {
    if (!lienSourceValide(v) || !/^https:\/\//i.test(v)) return { erreur: "Le lien doit commencer par https://" };
    if (/facebook\.com|fb\.com|fb\.me|instagram\.com/i.test(v)) return { erreur: messageScan("reseau_social") };
    return { lien: v };
  }
  if (v.length < TEXTE_MIN) return { erreur: "Colle d'abord le texte de l'annonce" };
  return { texte: v.slice(0, TEXTE_MAX) };
}

// D'où vient un événement non certifié (mêmes mots que l'appli).
export const ORIGINES = { affiche: "affiche scannée", import: "importé", agenda: "agenda de la commune" };
export const texteOrigine = (source) => ORIGINES[source] ?? "publié par un invité";
export const pluriel = (n, mot, motPluriel = mot + "s") => `${n} ${n > 1 ? motPluriel : mot}`;

// Filtre des non certifiés : recherche sans accents sur le titre, l'organisateur, le village ; et l'origine.
export function filtrerNonCertifies(liste, q, origine) {
  const n = normaliser(q);
  return liste.filter((e) => {
    if (origine === "affiche" && e.source !== "affiche") return false;
    if (origine === "import" && e.source !== "import") return false;
    if (origine === "invite" && (e.source === "affiche" || e.source === "import" || e.source === "agenda")) return false;
    return !n || [e.titre, e.organisateur, e.village].some((t) => normaliser(t ?? "").includes(n));
  });
}

// Journal des imports : « OK · 38 s », ou l'erreur.
export function dureeImport(debut, fin) {
  if (!debut || !fin) return "";
  const s = Math.max(0, Math.round((Date.parse(fin) - Date.parse(debut)) / 1000));
  return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
}

export function trouverLieu(b, lieux) {
  const commune = normaliser(b.commune);
  const memeCommune = (l) => !commune || normaliser(l.commune) === commune || normaliser(l.nom) === commune;
  for (const q of [b.village, b.commune]) {
    if (!q.trim()) continue;
    const exact = lieux.find((l) => normaliser(l.nom) === normaliser(q) && memeCommune(l));
    if (exact) return exact;
    const proche = chercherLieux(q, lieux, 5).find(memeCommune);
    if (proche && normaliser(proche.nom).startsWith(normaliser(q).slice(0, 4))) return proche;
  }
  return null;
}

export const RAYON_DOUBLON_KM = 3;
const motsTitre = (t) => normaliser(t).replace(/[^a-z0-9]+/g, " ").trim();
const motsUtiles = (t) => new Set(motsTitre(t).split(" ").filter((m) => m.length > 2));
export function titresProches(a, b) {
  const t = motsTitre(a);
  const u = motsTitre(b);
  if (!t || !u) return false;
  if (u === t || (Math.min(u.length, t.length) >= 6 && (u.includes(t) || t.includes(u)))) return true;
  const ma = motsUtiles(a);
  const mb = motsUtiles(b);
  if (!ma.size || !mb.size) return false;
  const [petit, grand] = ma.size <= mb.size ? [ma, mb] : [mb, ma];
  let communs = 0;
  for (const m of petit) if (grand.has(m)) communs++;
  return communs / petit.size >= 0.6;
}
export function dejaSurLokal(b, existants, lieu) {
  return (
    existants.find((e) => {
      if (!(e.date <= b.date && (e.dateFin ?? e.date) >= b.date)) return false;
      if (lieu && normaliser(e.village) !== normaliser(lieu.nom) && distanceKm(e, lieu) > RAYON_DOUBLON_KM) return false;
      return titresProches(b.titre, e.titre);
    }) ?? null
  );
}

// Messages d'erreur du scan (mêmes codes que la fonction « lire-affiche »).
export function messageScan(code) {
  return {
    limite: "Plafond atteint : 300 scans par jour pour l'équipe Lokal.",
    pas_de_cle: "Le scan n'est pas encore branché sur le serveur.",
    occupe: "Le serveur est occupé. Réessaie dans un instant.",
    admin: "Lire un texte ou un lien est réservé à l'équipe Lokal.",
    lien: "Ce lien ne s'ouvre pas. Copie plutôt le texte de la page.",
    reseau_social: "Facebook et Instagram ne se lisent pas par un lien. Copie le texte du post à la place.",
    page: "Cette page n'a pas assez de texte à lire.",
    reseau: "Pas de connexion. Vérifie ton internet et réessaie.",
  }[code] ?? "La lecture n'a pas marché. Réessaie, ou essaie avec une autre photo.";
}

// Inviter un admin : une adresse complète (même règle que l'appli).
export const emailAdminValide = (t) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(t.trim()) && t.trim().length <= 254;

// ---- Code Google Authenticator de l'équipe (comme l'appli, décision d'Arnaud du 24 nov. 2026) ----
// Réponse de admin_statut() : « non », « code_a_creer », « code_a_taper » ou « ok ». Tout le reste : « non ».
export const lireStatutAdmin = (v) => (["code_a_creer", "code_a_taper", "ok"].includes(v) ? v : "non");
export const codeValide = (s) => /^\d{6}$/.test(String(s ?? "").trim());
export function messageErreurCode(e) {
  const m = e && typeof e === "object" && "message" in e ? String(e.message) : "";
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  if (code === "mfa_verification_failed" || /invalid|expired/i.test(m)) return "Ce code n'est pas bon. Prends le code affiché maintenant dans Google Authenticator.";
  if (/network|fetch|Failed/i.test(m)) return "Pas de connexion. Vérifie ton internet et réessaie.";
  return "Ça n'a pas marché. Réessaie dans un instant.";
}
// Le carré QR envoyé par Supabase (« data:image/svg+xml;utf-8,<svg…> ») : on ré-encode le dessin pour que
// tous les navigateurs l'affichent. Seule une image SVG fournie ainsi est acceptée, jamais une adresse.
export function imageQr(brut) {
  const m = /^data:image\/svg\+xml(?:;[^,]*)?,([\s\S]*)$/.exec(String(brut ?? ""));
  if (!m) return "";
  let svg = m[1];
  if (!svg.trimStart().startsWith("<")) {
    try {
      svg = decodeURIComponent(svg);
    } catch {
      return "";
    }
  }
  return svg.trimStart().startsWith("<svg") || svg.trimStart().startsWith("<?xml") ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : "";
}
