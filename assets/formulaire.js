// « Ajouter un événement » sur le site : les mêmes règles que le formulaire de l'appli (src/app/evenement/formulaire.tsx).
// Fonctions sans écran, testées automatiquement (tests/formulaire.test.mjs).
import { ajouterJours, isoLocal, chercherLieux } from "./lokal.js";

// Les règles du prototype, dans le même ordre. Renvoie le message et le champ fautif.
export function verifier(s) {
  if (!s.titre.trim()) return { message: "Ajoute un titre pour publier.", champ: "titre" };
  if (!s.categorie) return { message: "Choisis le type de sortie pour publier.", champ: "categorie" };
  if (!s.date) return { message: "Ajoute une date pour publier.", champ: "date" };
  if (!s.village.trim()) return { message: "Ajoute le village pour publier.", champ: "village" };
  if (s.codePostal.trim() && !/^\d{4}$/.test(s.codePostal.trim())) return { message: "Le code postal doit avoir 4 chiffres.", champ: "codePostal" };
  if (s.payant && !s.prix.some((p) => p.montant.trim() !== "")) return { message: "Indique au moins un prix, ou décoche « Entrée payante ».", champ: "prix" };
  if (s.payant && s.prix.some((p) => p.montant.trim() !== "" && !(Number(p.montant.replace(",", ".")) >= 0))) return { message: "Un prix n'est pas un nombre.", champ: "prix" };
  return null;
}

// ---- Événements récurrents (lot 4) : chaque semaine, toutes les 2 semaines, chaque mois au même rang ----
export const MAX_DATES_SERIE = 26;
export const DUREE_SERIE_JOURS = 61;
export const REPETITIONS = [["", "Une seule fois"], ["7", "Chaque semaine"], ["14", "Toutes les 2 semaines"], ["m", "Chaque mois"]];

const versDate = (iso) => {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(a, m - 1, j);
};

export function datesSerie(debut, rythme, jusqua) {
  const dates = [debut];
  if (rythme === "m") {
    const d0 = versDate(debut);
    const jourSemaine = d0.getDay();
    const rang = Math.ceil(d0.getDate() / 7);
    for (let m = 1; dates.length < MAX_DATES_SERIE && m < 60; m++) {
      const premier = new Date(d0.getFullYear(), d0.getMonth() + m, 1);
      const jour = 1 + ((jourSemaine - premier.getDay() + 7) % 7) + (rang - 1) * 7;
      const d = new Date(premier.getFullYear(), premier.getMonth(), jour);
      if (d.getMonth() !== premier.getMonth()) continue; // pas de 5e dimanche ce mois-là
      const iso = isoLocal(d);
      if (iso > jusqua) break;
      dates.push(iso);
    }
  } else {
    for (let d = ajouterJours(debut, Number(rythme)); d <= jusqua && dates.length < MAX_DATES_SERIE; d = ajouterJours(d, Number(rythme))) dates.push(d);
  }
  return dates;
}

export function nouvelleSerie() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const h = () => Math.floor(Math.random() * 16).toString(16);
  const bloc = (n) => Array.from({ length: n }, h).join("");
  return `${bloc(8)}-${bloc(4)}-4${bloc(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${bloc(3)}-${bloc(12)}`;
}

// ---- Position : seulement depuis l'adresse ; sans rue (ou rue introuvable), le centre du village ----
// OpenStreetMap (Nominatim) : une seule recherche, au moment de publier, jamais pendant la frappe.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
export async function positionDepuisAdresse(a, lieux, fetcher = fetch) {
  const village = a.village.trim();
  if (!village) return null;
  const demander = async (params) => {
    const q = new URLSearchParams({ format: "jsonv2", countrycodes: "be", limit: "1", ...params });
    const r = await fetcher(`${NOMINATIM}?${q}`, { headers: { "Accept-Language": "fr" } });
    if (!r.ok) return null;
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) return null;
    const lat = Number(d[0].lat), lng = Number(d[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  };
  if (a.rue && a.rue.trim()) {
    try {
      const p = await demander({ street: `${a.numero ? a.numero.trim() + " " : ""}${a.rue.trim()}`, city: village, ...(a.codePostal ? { postalcode: a.codePostal.trim() } : {}) });
      if (p) return { ...p, precision: "adresse" };
    } catch {
      // pas de réseau : centre du village
    }
  }
  const v = chercherLieux(village, lieux, 1)[0];
  if (v) return { lat: v.lat, lng: v.lng, precision: "village" };
  try {
    const p = await demander({ city: village, ...(a.codePostal ? { postalcode: a.codePostal.trim() } : {}) });
    if (p) return { ...p, precision: "village" };
  } catch {
    // rien
  }
  return null;
}

// ---- La ligne envoyée à la base (mêmes colonnes que l'appli) ----
export function versLigne(e) {
  const vide = (s) => (s && String(s).trim() ? String(s).trim() : null);
  return {
    organisateur: e.organisateur.trim().slice(0, 60),
    titre: e.titre.trim(),
    categorie: e.categorie,
    date_debut: e.date,
    date_fin: e.dateFin && e.dateFin > e.date ? e.dateFin : null,
    heure_debut: e.heure,
    heure_fin: vide(e.heureFin),
    village: e.village.trim(),
    lieu: vide(e.lieu),
    rue: vide(e.rue),
    numero: vide(e.numero),
    code_postal: vide(e.codePostal),
    lat: e.lat,
    lng: e.lng,
    description: vide(e.description),
    prix: e.prix.map((p) => ({ nom: p.nom.trim() || "Entrée", montant: p.montant })),
    photo: e.photo,
    statut: "prevu",
    date_initiale: null,
    ...(e.serie && e.repetition ? { serie: e.serie, repetition: e.repetition } : {}),
    ...(e.prive ? { prive: true } : {}),
    ...(e.createur !== undefined ? { createur: e.createur } : {}),
    ...(e.groupeTaille !== undefined
      ? { groupe_taille: e.groupeTaille || null, groupe_deja: e.groupeTaille ? Math.min(e.groupeTaille - 1, Math.max(1, e.groupeDeja ?? 1)) : null }
      : {}),
  };
}

export const lirePrix = (lignes) =>
  lignes.filter((p) => p.montant.trim() !== "").map((p) => ({ nom: p.nom.trim() || "Entrée", montant: Number(p.montant.replace(",", ".")) }));

export function messageErreur(e) {
  const m = e && typeof e === "object" && "message" in e ? String(e.message) : "";
  if (/Limite de 20/.test(m)) return "Tu as déjà publié 20 événements aujourd'hui. Réessaie demain.";
  if (/network|fetch|Failed/i.test(m)) return "Pas de connexion. Vérifie ton internet et réessaie.";
  return "Ça n'a pas marché. Réessaie dans un instant.";
}

// L'affiche : réduite à 1400 px de large au maximum, en JPEG (comme l'appli), avant l'envoi.
export const LARGEUR_AFFICHE = 1400;
export function tailleReduite(l, h, max = LARGEUR_AFFICHE) {
  if (l <= max) return { l, h };
  return { l: max, h: Math.round((h * max) / l) };
}
