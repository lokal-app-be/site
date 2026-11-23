// Outils communs du site lokalapp.be, repris tels quels de l'appli Lokal (dossier src/lib du dépôt de l'appli).
// Rien ici ne touche à la page : ces fonctions sont aussi testées automatiquement (tests/lokal.test.mjs).

// ---------- Base de données (Supabase, Francfort) ----------
// Clé « publishable » : c'est la clé publique, la même que dans l'appli. Elle ne donne accès qu'à ce que
// les règles d'accès de la base permettent à un visiteur : les événements publics et visibles.
export const SUPABASE_URL = "https://ggubfbpiqmbzakyywezf.supabase.co";
export const SUPABASE_CLE = "sb_publishable_FCD3P6-hoMV-9RgHQq5VAw_4rhAQZUP";

// Si la personne ne donne pas sa position, la carte s'ouvre sur Tellin (jamais sur Bruxelles).
export const TELLIN = { lat: 50.08102, lng: 5.21683 };

// ---------- Types d'événements (src/lib/categories.ts) ----------
export const CATEGORIES = {
  culture: { nom: "Culture", couleur: "#2F6BFF" },
  fete: { nom: "Fête", couleur: "#D10F5C" },
  jeux: { nom: "Jeux", couleur: "#12A76A" },
  sport: { nom: "Sport", couleur: "#8A3FFC" },
  autre: { nom: "Autre", couleur: "#E07000" },
};
export const estCategorie = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(CATEGORIES, v);

// Les vraies icônes de l'appli (src/data/icones.json), sans aucun changement.
const ICONES = {
  culture: {
    viewBox: "0.1 -0.34 24 24",
    corps: '<g transform="rotate(12 17 10)"> <path d="M11 4.2C14.2 3 17.8 3 21 4.2V10.5C21 14.6 19 17 16 17S11 14.6 11 10.5Z"/> <path fill="{GAP}" d="M12.8 8.6c.6-.9 2-.9 2.6 0-.8-.3-1.8-.3-2.6 0ZM16.8 8.6c.6-.9 2-.9 2.6 0-.8-.3-1.8-.3-2.6 0Z"/> <path fill="none" stroke="{GAP}" stroke-width="1.3" stroke-linecap="round" d="M13.6 13.8c1.4-1.5 3.4-1.5 4.8 0"/> </g> <g transform="rotate(-12 8 14)"> <path stroke="{GAP}" stroke-width="1.6" paint-order="stroke" d="M3 8.2C6.2 7 9.8 7 13 8.2V14.5C13 18.6 11 21 8 21S3 18.6 3 14.5Z"/> <path fill="none" stroke="{GAP}" stroke-width="1.2" stroke-linecap="round" d="M4.6 12.2c.6-.9 2-.9 2.6 0M8.8 12.2c.6-.9 2-.9 2.6 0"/> <path fill="{GAP}" d="M5.2 15.2h5.6c-.4 2-1.5 3-2.8 3s-2.4-1-2.8-3Z"/> </g>',
  },
  fete: {
    viewBox: "-0.36 0.42 24 24",
    corps: '<path stroke="{INK}" stroke-width="1.4" stroke-linejoin="round" d="M2.3 21.7 7.4 8.6l8 8Z"/> <path fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round" d="M10.2 10.6c.8-2.4-1.2-3.4-.2-5.2s3.2-.6 2.8 1.2"/> <path fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round" d="M13.4 13.8c1.8-1.4 3.2-.2 4.8-1.4s.6-3 2.6-3.2"/> <rect x="15" y="3" width="2.6" height="2.6" rx=".4" transform="rotate(20 16.3 4.3)"/> <rect x="19.2" y="15.6" width="2.6" height="2.6" rx=".4" transform="rotate(-15 20.5 16.9)"/> <circle cx="4.6" cy="5" r="1.3"/><circle cx="20.6" cy="5.6" r="1.2"/>',
  },
  jeux: {
    viewBox: "-0.15 -0.03 24 24",
    corps: '<rect x="2" y="2.6" width="10.4" height="10.4" rx="2.4" transform="rotate(-14 7.2 7.8)"/> <g fill="{GAP}"><circle cx="5" cy="5.8" r="1.1"/><circle cx="8.8" cy="4.9" r="1.1"/><circle cx="5.7" cy="9.6" r="1.1"/><circle cx="9.5" cy="8.7" r="1.1"/></g> <rect x="11.2" y="10.8" width="10.4" height="10.4" rx="2.4" transform="rotate(16 16.4 16)"/> <g fill="{GAP}"><circle cx="18.8" cy="13.4" r="1.1"/><circle cx="16.4" cy="16" r="1.1"/><circle cx="14" cy="18.6" r="1.1"/></g>',
  },
  sport: {
    viewBox: "0 -0.7 24 24",
    corps: '<path d="M6.5 3h11v5.6c0 3.4-2.4 6-5.5 6s-5.5-2.6-5.5-6Z"/> <path fill="none" stroke="{INK}" stroke-width="2" stroke-linecap="round" d="M6.6 5H3.4c0 3.4 1.8 5.2 4.4 5.4M17.4 5h3.2c0 3.4-1.8 5.2-4.4 5.4"/> <path d="M10.6 14h2.8v3.6h-2.8Z"/><rect x="7" y="17.4" width="10" height="3.6" rx="1"/>',
  },
  autre: {
    viewBox: "0 0 24 24",
    corps: '<circle cx="4.6" cy="12" r="2.7"/><circle cx="12" cy="12" r="2.7"/><circle cx="19.4" cy="12" r="2.7"/>',
  },
};

// Icône pleine, blanche sur la couleur du type (mode jour de l'appli).
export function svgIcone(cat) {
  const c = estCategorie(cat) ? cat : "autre";
  const i = ICONES[c];
  const fond = CATEGORIES[c].couleur;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${i.viewBox}" fill="#FFFFFF" aria-hidden="true">${i.corps
    .replaceAll("{GAP}", fond)
    .replaceAll("{INK}", "#FFFFFF")}</svg>`;
}

// ---------- Textes ----------
export const normaliser = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// ---------- Dates (src/lib/dates.ts), toujours à l'heure belge ----------
const pad = (n) => String(n).padStart(2, "0");
export const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function versDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
export function ajouterJours(iso, n) {
  const d = versDate(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

// Aujourd'hui en Belgique, même si l'ordinateur du visiteur est réglé sur un autre fuseau.
export function aujourdhuiBelgique(maintenant = new Date()) {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(maintenant);
}

// Le week-end va du vendredi 18 h au dimanche soir. Le samedi, il reste samedi et dimanche ; le dimanche, seulement dimanche.
export function joursDuWeekend(aujourdhui) {
  const dow = versDate(aujourdhui).getDay();
  if (dow === 0) return [aujourdhui];
  if (dow === 6) return [aujourdhui, ajouterJours(aujourdhui, 1)];
  const vendredi = ajouterJours(aujourdhui, 5 - dow);
  return [vendredi, ajouterJours(vendredi, 1), ajouterJours(vendredi, 2)];
}

// mode : "today" (Aujourd'hui), "weekend" (Ce week-end, par défaut) ou "date" (Autre date).
export function periode(mode, aujourdhui, dateChoisie) {
  if (mode === "today") return { jours: [aujourdhui], vendrediDes18h: false };
  if (mode === "date") return { jours: [dateChoisie || aujourdhui], vendrediDes18h: false };
  const jours = joursDuWeekend(aujourdhui);
  return { jours, vendrediDes18h: versDate(jours[0]).getDay() === 5 };
}

export const dernierJour = (e) => e.dateFin || e.date;
export const aLieuLe = (e, jour) => jour >= e.date && jour <= dernierJour(e);

// Le vendredi du week-end, on ne garde que ce qui commence à 18 h ou plus tard (ou ce qui dure plusieurs jours).
export function dansPeriode(e, p) {
  if (!p.jours.some((j) => aLieuLe(e, j))) return false;
  const vendredi = p.jours[0];
  if (p.vendrediDes18h && e.date === vendredi && (e.heure || "") < "18:00" && !(e.dateFin && e.dateFin > vendredi)) return false;
  return true;
}

// « Sam. 29 nov. »
export function formatJour(iso, opts) {
  const t = versDate(iso).toLocaleDateString("fr-BE", opts || { weekday: "short", day: "numeric", month: "short" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Pastille de date, comme dans l'appli : « AUJ. · 20:00 », « SAM 29.11 · 20:00 », « 25.10 → 27.10 · 14:00 ».
export function pastilleDate(e, aujourdhui) {
  const jm = (iso) => {
    const [, m, d] = iso.split("-");
    return `${d}.${m}`;
  };
  const h = e.heure ? ` · ${e.heure.slice(0, 5)}` : "";
  if (e.dateFin) return `${e.date === aujourdhui ? "AUJ." : jm(e.date)} → ${jm(e.dateFin)}${h}`;
  if (e.date === aujourdhui) return `AUJ.${h}`;
  const wd = versDate(e.date).toLocaleDateString("fr-BE", { weekday: "short" }).replace(".", "").slice(0, 3).toUpperCase();
  return `${wd} ${jm(e.date)}${h}`;
}

// « c'est ce soir ! », « c'est demain ! »
export function bientot(e, aujourdhui) {
  if (e.date === aujourdhui) return (e.heure || "") >= "17:00" ? "c'est ce soir !" : "c'est aujourd'hui !";
  if (aLieuLe(e, aujourdhui)) return "c'est en ce moment !";
  if (e.date === ajouterJours(aujourdhui, 1)) return "c'est demain !";
  return "";
}

// ---------- Événements (src/lib/evenements.ts) ----------
// Seulement les colonnes utiles au site : jamais l'identifiant de la personne qui a publié.
export const COLONNES =
  "id,organisateur,certifie,source,titre,categorie,date_debut,date_fin,heure_debut,heure_fin,village,lieu,rue,numero,code_postal,lat,lng,description,prix,photo,statut,date_initiale,nb_participants,source_url,source_nom,adresse_cachee,image_url,journee";

export const IMAGES_AGENDA = "https://www.odwb.be/api/explore/v2.1/catalog/datasets/evenements-en-wallonie/files/";
export const IMAGES_BRUXELLES = "https://agendabrussels2.imgix.net/";
export const imageAgendaOk = (u) => !!u && (u.startsWith(IMAGES_AGENDA) || u.startsWith(IMAGES_BRUXELLES));

// Photo d'affiche publiée dans l'appli : dossier public « affiches » de Supabase.
export function urlAffiche(chemin) {
  if (!chemin) return null;
  if (imageAgendaOk(chemin)) return chemin;
  if (/^https?:/i.test(chemin) || chemin.includes("..")) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/affiches/${chemin.split("/").map(encodeURIComponent).join("/")}`;
}

const hm = (t) => (t ? String(t).slice(0, 5) : null);

function lirePrix(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "object" && x !== null)
    .map((x) => ({ nom: String(x.nom ?? "Entrée").slice(0, 30), montant: Number(x.montant) }))
    .filter((x) => Number.isFinite(x.montant) && x.montant >= 0);
}

export function depuisLigne(l) {
  return {
    id: l.id,
    organisateur: l.organisateur,
    certifie: !!l.certifie,
    source: l.source,
    titre: l.titre,
    categorie: estCategorie(l.categorie) ? l.categorie : "autre",
    date: l.date_debut,
    dateFin: l.date_fin,
    heure: l.journee ? "" : hm(l.heure_debut) || "20:00",
    journee: !!l.journee,
    heureFin: hm(l.heure_fin),
    village: l.village,
    lieu: l.lieu,
    rue: l.rue,
    numero: l.numero,
    codePostal: l.code_postal,
    lat: Number(l.lat),
    lng: Number(l.lng),
    description: l.description,
    prix: lirePrix(l.prix),
    photo: l.source === "agenda" ? (imageAgendaOk(l.image_url) ? l.image_url : null) : urlAffiche(l.photo),
    statut: l.statut,
    dateInitiale: l.date_initiale,
    nbParticipants: Number(l.nb_participants) || 0,
    sourceUrl: l.source_url && /^https?:\/\//.test(l.source_url) ? l.source_url : null,
    sourceNom: l.source_nom ?? null,
    adresseCachee: !!l.adresse_cachee,
  };
}

// Adresse de l'appli : « Rue de la Gare 3, 6927 Tellin ».
export const adresseComplete = (e) =>
  `${e.rue ? `${e.rue}${e.numero ? " " + e.numero : ""}, ` : ""}${e.codePostal ? e.codePostal + " " : ""}${e.village}`;

const montant = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

// Ligne « Entrée » de la fiche, comme dans l'appli.
export function texteEntree(e) {
  if (e.prix.length && e.prix.every((p) => p.montant === 0)) return "Gratuit";
  if (e.prix.length) return e.prix.map((p) => `${p.nom} : ${montant(p.montant)} €`).join("\n");
  return e.source === "agenda" ? "Pas précisé (voir la description)" : "Gratuit";
}

// Ligne « Quand » (seulement pour un événement sur plusieurs jours, avec une heure de fin ou toute la journée).
export function texteQuand(e) {
  const lignes = [];
  const long = { weekday: "long", day: "numeric", month: "long" };
  if (e.dateFin) lignes.push(`Du ${formatJour(e.date, long).toLowerCase()} au ${formatJour(e.dateFin, long).toLowerCase()}`);
  if (e.heureFin) lignes.push(`${e.dateFin ? "Chaque jour de" : "De"} ${e.heure} à ${e.heureFin}`);
  if (e.journee) lignes.push("Toute la journée");
  return lignes.join("\n");
}

// Plusieurs événements à la même adresse : on les écarte un peu en cercle (src/lib/ecarter.ts).
export function ecarter(liste) {
  const groupes = new Map();
  for (const e of liste) {
    const cle = `${e.lat.toFixed(5)},${e.lng.toFixed(5)}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), e]);
  }
  const res = [];
  for (const g of groupes.values()) {
    const tries = [...g].sort((a, b) => a.id.localeCompare(b.id));
    tries.forEach((e, i) => {
      if (tries.length === 1) return res.push({ ...e, latAff: e.lat, lngAff: e.lng });
      const angle = (2 * Math.PI * i) / tries.length;
      const metres = 30;
      res.push({
        ...e,
        latAff: e.lat + (metres / 111320) * Math.cos(angle),
        lngAff: e.lng + (metres / (111320 * Math.cos((e.lat * Math.PI) / 180))) * Math.sin(angle),
      });
    });
  }
  return res;
}

export function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export const formatKm = (v) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")} km`;

// ---------- Recherche de villages (src/lib/recherche.ts) ----------
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const fautesPermises = (n) => (n >= 8 ? 2 : n >= 4 ? 1 : 0);
function motTrouve(q, w) {
  if (w === q || (q.length >= 3 && w.startsWith(q))) return true;
  const k = fautesPermises(q.length);
  return k > 0 && (levenshtein(q, w) <= k || (q.length >= 5 && w.length > q.length && levenshtein(q, w.slice(0, q.length)) <= 1));
}
const mots = (s) => normaliser(s).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
function correspond(q, texte) {
  const ws = mots(texte);
  const qs = mots(q);
  return qs.length > 0 && qs.every((x) => ws.some((w) => motTrouve(x, w)));
}

// Une ligne de lieux-be.json : [nom, commune, latitude, longitude, importance].
export const lireLieux = (lignes) =>
  lignes.map(([nom, commune, lat, lng, importance]) => ({
    nom,
    commune: commune || nom,
    lat,
    lng,
    importance,
    estCommune: normaliser(nom) === normaliser(commune || nom),
  }));
export const libelleLieu = (l) => (l.estCommune ? l.nom : `${l.nom} (${l.commune})`);

export function chercherLieux(q, lieux, max = 8) {
  const nq = normaliser(q);
  if (nq.length < 2) return [];
  const scored = [];
  for (const l of lieux) {
    const nom = normaliser(l.nom);
    let s;
    if (nom === nq) s = 0;
    else if (nom.startsWith(nq)) s = 1;
    else if (correspond(q, l.nom)) s = 2;
    else if (correspond(q, `${l.nom} ${l.commune}`)) s = 3;
    else continue;
    scored.push({ l, s: s * 10 + (l.estCommune ? 0 : 5) + l.importance });
  }
  scored.sort((a, b) => a.s - b.s || a.l.nom.localeCompare(b.l.nom, "fr"));
  return scored.slice(0, max).map((x) => x.l);
}
