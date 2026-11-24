// Accueil de lokalapp.be : le carrousel, puis la carte des événements (MapLibre + OpenFreeMap) et la fiche d'un événement.
import {
  SUPABASE_URL, SUPABASE_CLE, TELLIN, CATEGORIES, COLONNES, svgIcone, depuisLigne, ecarter,
  aujourdhuiBelgique, periode, dansPeriode, pastilleDate, bientot, formatJour, texteEntree, texteQuand,
  adresseComplete, distanceKm, lireLieux, chercherLieux, libelleLieu,
} from "./lokal.js";

const doux = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s) => document.querySelector(s);
function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function ico(cat, petit) {
  const s = el("span", "ico" + (petit ? " petit" : ""));
  s.style.background = CATEGORIES[cat].couleur;
  s.innerHTML = svgIcone(cat); // icône de l'appli, texte fixe (jamais une donnée)
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", CATEGORIES[cat].nom);
  return s;
}

// Les icônes des visuels (data-icone) et « Remonter en haut » : voir page.js, commun à toutes les pages.

// ================= Carrousel =================
const piste = $("#piste");
const diapos = [...piste.querySelectorAll(".slide")];
const points = $("#points");
let actuelle = 0;
diapos.forEach((d, i) => {
  const b = el("button", "point");
  b.type = "button";
  b.setAttribute("role", "tab");
  b.setAttribute("aria-label", `Diapositive ${i + 1} sur ${diapos.length}`);
  b.addEventListener("click", () => allerDiapo(i));
  points.append(b);
});
function marquer(i) {
  actuelle = i;
  points.querySelectorAll(".point").forEach((p, j) => p.setAttribute("aria-selected", j === i ? "true" : "false"));
  diapos.forEach((d, j) => d.toggleAttribute("inert", j !== i));
}
function allerDiapo(i) {
  i = (i + diapos.length) % diapos.length;
  diapos[i].removeAttribute("inert");
  piste.scrollTo({ left: i * piste.clientWidth, behavior: doux ? "smooth" : "auto" });
  marquer(i);
}
$("#prec").addEventListener("click", () => allerDiapo(actuelle - 1));
$("#suiv").addEventListener("click", () => allerDiapo(actuelle + 1));
piste.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { e.preventDefault(); allerDiapo(actuelle + 1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); allerDiapo(actuelle - 1); }
});
let tDiapo;
piste.addEventListener("scroll", () => {
  clearTimeout(tDiapo);
  tDiapo = setTimeout(() => marquer(Math.round(piste.scrollLeft / Math.max(1, piste.clientWidth))), 80);
}, { passive: true });
addEventListener("resize", () => piste.scrollTo({ left: actuelle * piste.clientWidth }));
document.querySelectorAll("a[data-diapo]").forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    $(".hero").scrollIntoView({ behavior: doux ? "smooth" : "auto" });
    allerDiapo(Number(a.getAttribute("data-diapo")));
  }),
);
marquer(0);

// ================= Carte =================
const ZONE = $("#zone");
const PANNEAU = $("#panneau");
const ETAT = $("#etat-carte");
const deuxColonnes = matchMedia("(min-width: 900px)");
const aujourdhui = aujourdhuiBelgique();
let mode = "weekend";
let dateChoisie = null;
let evenements = [];
let selection = null;
let horsPeriode = null; // événement ouvert depuis la recherche, en dehors de la période : montré seul sur la carte
let carte = null;
let demande = 0;

function etat(texte) {
  ETAT.textContent = texte || "";
  ETAT.hidden = !texte;
}

async function api(chemin, options = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    ...options,
    headers: { apikey: SUPABASE_CLE, Authorization: `Bearer ${SUPABASE_CLE}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

// Les événements de la période, partout en Belgique (comme l'appli).
async function chargerEvenements() {
  const n = ++demande;
  const p = periode(mode, aujourdhui, dateChoisie);
  const debut = p.jours[0];
  const fin = p.jours[p.jours.length - 1];
  etat("Chargement des sorties…");
  try {
    const q = new URLSearchParams({
      select: COLONNES,
      visibilite: "eq.visible",
      date_debut: `lte.${fin}`,
      or: `(date_fin.gte.${debut},and(date_fin.is.null,date_debut.gte.${debut}))`,
      order: "date_debut,heure_debut",
      limit: "2000",
    });
    const lignes = await api(`evenements?${q}`);
    if (n !== demande) return;
    evenements = lignes.map(depuisLigne).filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng) && dansPeriode(e, p));
    afficherSurCarte();
    const quand = mode === "today" ? "aujourd'hui" : mode === "weekend" ? "ce week-end" : `le ${formatJour(dateChoisie).toLowerCase()}`;
    etat(evenements.length ? "" : `Pas encore de sortie ${quand} sur Lokal.`);
  } catch {
    if (n === demande) etat("Les sorties n'ont pas pu être chargées. Réessaie dans un moment.");
  }
}

function donnees() {
  return {
    type: "FeatureCollection",
    features: ecarter(horsPeriode && !evenements.some((x) => x.id === horsPeriode.id) ? [...evenements, horsPeriode] : evenements).map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lngAff, e.latAff] },
      properties: { id: e.id, cat: e.categorie, annule: e.statut === "annule" ? 1 : 0 },
    })),
  };
}
function afficherSurCarte() {
  const s = carte && carte.getSource("evenements");
  if (s) s.setData(donnees());
  marquerSelection();
}
function marquerSelection() {
  if (carte && carte.getLayer("selection")) carte.setFilter("selection", ["==", ["get", "id"], selection || ""]);
}

// Les noms écrits seulement en Belgique, et le voile sur les pays voisins (src/map/style.ts de l'appli).
async function preparerStyle() {
  const [style, voile] = await Promise.all([
    fetch("/apercu-6vqdt5j6tp/assets/carte/jour.json").then((r) => r.json()),
    fetch("/apercu-6vqdt5j6tp/assets/carte/hors-belgique.json").then((r) => r.json()),
  ]);
  const anneaux = voile.geometry.coordinates;
  const belgique = { type: "MultiPolygon", coordinates: anneaux.slice(1).map((trou) => [trou]) };
  style.layers = style.layers.map((l) =>
    l.type === "symbol" ? { ...l, filter: l.filter ? ["all", l.filter, ["within", belgique]] : ["within", belgique] } : l,
  );
  const premierNom = style.layers.find((l) => l.type === "symbol").id;
  return { style, voile, premierNom };
}

const PROCHAINEMENT = [
  { pays: "France", lng: 4.6, lat: 49.35 },
  { pays: "Pays-Bas", lng: 5.4, lat: 51.68 },
  { pays: "Allemagne", lng: 6.8, lat: 50.5 },
  { pays: "Luxembourg", lng: 6.27, lat: 49.62 },
];

async function demarrerCarte() {
  if (!window.maplibregl) {
    etat("La carte n'a pas pu s'afficher sur ce navigateur.");
    return;
  }
  const ml = window.maplibregl;
  ml.setWorkerUrl("/apercu-6vqdt5j6tp/assets/maplibre/maplibre-gl-csp-worker.js");
  let prep;
  try {
    prep = await preparerStyle();
  } catch {
    etat("La carte n'a pas pu s'afficher. Réessaie dans un moment.");
    return;
  }
  const souris = matchMedia("(pointer: fine)").matches;
  carte = new ml.Map({
    container: "map",
    style: prep.style,
    // Jamais Bruxelles. À l'arrivée, la carte montre la Wallonie (vue choisie par Arnaud le 24 nov. 2026) :
    // de Mons à Eupen et Saint-Vith, de Wavre à Libramont. Tellin est dedans. Même zone sur chaque écran.
    bounds: [[3.85, 49.88], [6.25, 50.78]],
    minZoom: 7,
    maxZoom: 18,
    maxBounds: [[1.6, 48.9], [7.4, 52.1]],
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: { compact: true },
    // Sur ordinateur, la molette fait défiler la page ; Ctrl + molette zoome la carte.
    cooperativeGestures: souris,
    locale: {
      "CooperativeGesturesHandler.WindowsHelpText": "Utilise Ctrl + molette pour zoomer sur la carte",
      "CooperativeGesturesHandler.MacHelpText": "Utilise ⌘ + molette pour zoomer sur la carte",
      "CooperativeGesturesHandler.MobileHelpText": "Utilise deux doigts pour déplacer la carte",
      "AttributionControl.ToggleAttribution": "Afficher les crédits",
      "ScrollZoomBlocker.CtrlMessage": "Utilise Ctrl + molette pour zoomer sur la carte",
      "ScrollZoomBlocker.CmdMessage": "Utilise ⌘ + molette pour zoomer sur la carte",
      "TouchPanBlocker.Message": "Utilise deux doigts pour déplacer la carte",
    },
  });
  carte.on("zoomend", majZoom);
  carte.touchZoomRotate.disableRotation();
  carte.keyboard.disableRotation();

  carte.on("load", async () => {
    carte.addSource("voile", { type: "geojson", data: prep.voile });
    carte.addLayer({ id: "voile-hors-belgique", type: "fill", source: "voile", paint: { "fill-color": "#F3F4F7", "fill-opacity": 0.7 } }, prep.premierNom);
    carte.addSource("prochainement", {
      type: "geojson",
      data: { type: "FeatureCollection", features: PROCHAINEMENT.map((p) => ({ type: "Feature", properties: { pays: p.pays }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) },
    });
    carte.addLayer({
      id: "prochainement", type: "symbol", source: "prochainement", maxzoom: 9.5,
      layout: { "text-field": "Prochainement", "text-font": ["Noto Sans Italic"], "text-size": 15, "text-allow-overlap": true, "text-ignore-placement": true },
      paint: { "text-color": "#5B6275" },
    });

    // Les vrais repères de l'appli (assets/markers, en 3x).
    await Promise.all(
      Object.keys(CATEGORIES).map(async (cat) => {
        const img = await carte.loadImage(`/apercu-6vqdt5j6tp/assets/reperes/${cat}.png`);
        if (!carte.hasImage(cat)) carte.addImage(cat, img.data, { pixelRatio: 3 });
      }),
    );

    carte.addSource("evenements", { type: "geojson", data: donnees(), cluster: true, clusterRadius: 40, clusterMaxZoom: 14 });
    carte.addLayer({
      id: "groupes", type: "circle", source: "evenements", filter: ["has", "point_count"],
      paint: { "circle-radius": 18, "circle-color": "#111111", "circle-stroke-width": 3, "circle-stroke-color": "#FFFFFF" },
    });
    carte.addLayer({
      id: "groupes-nombre", type: "symbol", source: "evenements", filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 16, "text-allow-overlap": true },
      paint: { "text-color": "#FFFFFF" },
    });
    // L'événement ouvert : entouré de blanc puis de rose (maquette validée).
    carte.addLayer({
      id: "selection", type: "circle", source: "evenements", filter: ["==", ["get", "id"], ""],
      paint: { "circle-radius": 26, "circle-color": "#FFFFFF", "circle-stroke-width": 3, "circle-stroke-color": "#D10F5C" },
    });
    carte.addLayer({
      id: "reperes", type: "symbol", source: "evenements", filter: ["!", ["has", "point_count"]],
      layout: { "icon-image": ["get", "cat"], "icon-size": 1, "icon-allow-overlap": true },
      paint: { "icon-opacity": ["case", ["==", ["get", "annule"], 1], 0.45, 1] },
    });

    // Un rond avec un nombre : la liste de ses événements (demande d'Arnaud du 24 nov. 2026), et non plus un zoom.
    carte.on("click", "groupes", async (ev) => {
      const f = ev.features[0];
      const source = carte.getSource("evenements");
      const feuilles = await source.getClusterLeaves(f.properties.cluster_id, Infinity, 0);
      const ids = new Set(feuilles.map((x) => x.properties.id));
      const liste = [...evenements, ...(horsPeriode ? [horsPeriode] : [])].filter((e) => ids.has(e.id));
      if (!liste.length) return;
      ouvrirGroupe({ liste, centre: f.geometry.coordinates, zoom: await source.getClusterExpansionZoom(f.properties.cluster_id) });
    });
    carte.on("click", "reperes", (ev) => {
      const id = ev.features[0].properties.id;
      const e = evenements.find((x) => x.id === id) || (horsPeriode && horsPeriode.id === id ? horsPeriode : null);
      if (e) ouvrirFiche(e, { deplacer: false });
    });
    for (const id of ["groupes", "reperes"]) {
      carte.on("mouseenter", id, () => (carte.getCanvas().style.cursor = "pointer"));
      carte.on("mouseleave", id, () => (carte.getCanvas().style.cursor = ""));
    }
    afficherSurCarte();
    if (aCentrer) carte.jumpTo({ center: [aCentrer.lng, aCentrer.lat], zoom: Math.max(carte.getZoom(), 14) });
  });
}

// ================= Fiche d'un événement =================
const DEGRADES = {
  culture: "linear-gradient(160deg,#6F9BFF,#1B3FA6)",
  fete: "linear-gradient(160deg,#FF5CA3,#7A0F3E)",
  jeux: "linear-gradient(160deg,#4FD39C,#0B6B44)",
  sport: "linear-gradient(160deg,#B98CFF,#4A1FA8)",
  autre: "linear-gradient(160deg,#FFA655,#9A4A00)",
};
const SVG_FERMER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const SVG_RETOUR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

function rang(dl, etiquette, valeur) {
  const r = el("div", "rang");
  r.append(el("dt", "", etiquette), el("dd", "", valeur));
  dl.append(r);
}
function lien(href, texte, cls) {
  const a = el("a", cls || "", texte);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function carteProche(e, { depuisGroupe = false } = {}) {
  const b = el("button", "evc");
  b.type = "button";
  const t = el("div", "evc-t");
  const p = el("div", "pills");
  p.append(el("span", "pdate", pastilleDate(e, aujourdhui)));
  if (e.certifie) p.append(el("span", "certif", "✓ Certifié"));
  t.append(p, el("b", "", e.titre), el("small", "", [e.lieu, e.village].filter(Boolean).join(" · ")));
  b.append(ico(e.categorie), t);
  b.addEventListener("click", () => ouvrirFiche(e, { deplacer: !depuisGroupe, depuisGroupe }));
  return b;
}

function noteNonCertifie(e) {
  const box = el("p", "non-certifie");
  const bxl = e.sourceNom === "visit.brussels";
  let detail;
  let explication;
  if (e.source === "agenda") {
    detail = e.sourceNom || (bxl ? "agenda de Bruxelles" : "agenda de la commune");
    explication = bxl
      ? "Cet événement vient de l'agenda en ligne de Bruxelles (visit.brussels, données ouvertes). Lokal le reprend automatiquement."
      : "Cet événement vient de l'agenda en ligne de la commune (données ouvertes iMio, licence CC BY). Lokal le reprend automatiquement.";
    explication += " L'organisateur ne l'a pas encore publié lui-même sur Lokal : regarde la source avant d'y aller.";
  } else if (e.source === "import") {
    detail = "infos importées";
    explication = "Ces infos ont été reprises par l'équipe Lokal d'une annonce publiée ailleurs. L'organisateur ne les a pas encore vérifiées : regarde la source avant d'y aller.";
  } else if (e.source === "affiche") {
    detail = "affiche scannée";
    explication = "Ces infos ont été lues sur une affiche. L'organisateur ne les a pas encore vérifiées : regarde l'affiche avant d'y aller.";
  } else return null;
  const b = el("b", "", "Non certifié");
  box.append(b, ` · ${detail}. ${explication}`);
  if (e.sourceUrl) {
    box.append(" ");
    box.append(lien(e.sourceUrl, `Source : ${e.sourceNom || "voir l'annonce"} ↗`));
  }
  return box;
}

let ficheDansHistorique = false;
let groupeOuvert = null; // { liste, centre, zoom } : la fiche ouverte depuis la liste d'un rond revient à cette liste

// Montre le panneau (à droite sur tablette et ordinateur, en plein écran sur téléphone).
function montrerPanneau(contenu, titre) {
  PANNEAU.replaceChildren(...contenu);
  PANNEAU.setAttribute("aria-labelledby", titre.id);
  PANNEAU.hidden = false;
  PANNEAU.scrollTop = 0;
  ZONE.classList.add("ouvert");
  if (!deuxColonnes.matches) {
    document.body.classList.add("fiche-ouverte");
    // Le bouton « retour » du téléphone ferme le panneau au lieu de quitter le site.
    if (!ficheDansHistorique) {
      history.pushState({ fiche: true }, "");
      ficheDansHistorique = true;
    }
  }
  titre.focus({ preventScroll: true });
  if (carte) carte.resize();
}

// Les événements d'un rond avec un nombre, par date.
function ouvrirGroupe(g) {
  groupeOuvert = g;
  selection = null;
  marquerSelection();
  const telephone = !deuxColonnes.matches;
  const fermer = el("button", "rond petit fermer");
  fermer.type = "button";
  fermer.setAttribute("aria-label", telephone ? "Retour à la carte" : "Fermer la liste");
  fermer.innerHTML = telephone ? SVG_RETOUR : SVG_FERMER;
  fermer.addEventListener("click", () => fermerFiche());
  const tries = [...g.liste].sort((a, b) => `${a.date} ${a.heure || ""}`.localeCompare(`${b.date} ${b.heure || ""}`) || a.titre.localeCompare(b.titre));
  const titre = el("h3", "titre-fiche", `${tries.length} événements ici`);
  titre.id = "titre-groupe";
  titre.tabIndex = -1;
  const zoomer = el("button", "btn sec petit", "Zoomer sur la carte");
  zoomer.type = "button";
  zoomer.addEventListener("click", () => {
    const g2 = groupeOuvert;
    fermerFiche();
    if (carte && g2) carte.easeTo({ center: g2.centre, zoom: g2.zoom, duration: doux ? 600 : 0 });
  });
  const liste = el("div", "proches");
  liste.append(...tries.map((e) => carteProche(e, { depuisGroupe: true })));
  const actions = el("div", "actions");
  actions.append(zoomer);
  const corps = el("div", "corps seul");
  corps.append(titre, actions, liste);
  montrerPanneau([fermer, corps], titre);
}

function ouvrirFiche(e, { deplacer, depuisGroupe = false }) {
  if (!depuisGroupe) groupeOuvert = null;
  selection = e.id;
  const avant = horsPeriode;
  horsPeriode = evenements.some((x) => x.id === e.id) ? null : e;
  if (avant !== horsPeriode) afficherSurCarte();
  else marquerSelection();

  const fermer = el("button", "rond petit fermer");
  fermer.type = "button";
  const telephone = !deuxColonnes.matches;
  const retour = telephone || !!groupeOuvert;
  fermer.setAttribute("aria-label", groupeOuvert ? "Retour à la liste" : telephone ? "Retour à la carte" : "Fermer la fiche");
  fermer.innerHTML = retour ? SVG_RETOUR : SVG_FERMER;
  fermer.addEventListener("click", () => (groupeOuvert ? ouvrirGroupe(groupeOuvert) : fermerFiche()));

  // Affiche en grand en haut (option B de la charte) : la photo, sinon une affiche dessinée aux couleurs du type.
  const aff = el("div", "grande-affiche");
  aff.style.background = DEGRADES[e.categorie];
  if (e.photo) {
    const img = el("img");
    img.src = e.photo;
    img.alt = e.source === "agenda" ? `Image de l'agenda, ${e.sourceNom || "commune"}` : "Photo de l'affiche";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => img.remove());
    aff.append(img);
  } else {
    aff.append(el("span", "", e.titre), el("small", "", `${pastilleDate(e, aujourdhui)} · ${e.lieu || e.village}`));
  }
  const contenu = [fermer, aff];

  const corps = el("div", "corps");
  // Image d'un agenda communal : sa source toujours sous l'image (licence CC BY, décidé le 19 nov. 2026).
  if (e.photo && e.source === "agenda") corps.append(el("p", "source-image", `Image : ${e.sourceNom || "agenda de la commune"}`));
  const note = e.statut === "annule" ? "" : bientot(e, aujourdhui);
  if (note) corps.append(el("p", "note-quand", note));
  const bandeau =
    e.statut === "reporte" ? `Reporté${e.dateInitiale ? ` (prévu le ${formatJour(e.dateInitiale).toLowerCase()})` : ""}`
      : e.statut === "annule" ? "Annulé par l'organisateur"
        : e.statut === "complet" ? "Complet" : null;
  if (bandeau) corps.append(el("p", "bandeau", bandeau));
  const pills = el("div", "pills");
  pills.append(ico(e.categorie, true), el("span", "pdate", pastilleDate(e, aujourdhui)));
  if (e.certifie) pills.append(el("span", "certif", "✓ Certifié"));
  corps.append(pills);
  const titre = el("h3", "titre-fiche", e.titre);
  titre.id = "titre-fiche";
  titre.tabIndex = -1;
  corps.append(titre);

  const dl = el("dl", "tableau");
  rang(dl, "Lieu", e.adresseCachee ? `Secteur ${e.village} (adresse cachée)` : `${e.lieu ? `${e.lieu}, ` : ""}${adresseComplete(e)}`);
  const quand = texteQuand(e);
  if (quand) rang(dl, "Quand", quand);
  rang(dl, "Entrée", texteEntree(e));
  rang(dl, "Organisé par", e.organisateur);
  corps.append(dl);

  const actions = el("div", "actions");
  if (e.statut !== "annule") actions.append(el("span", "bientot", "J'y vais ! · bientôt dans l'appli"));
  if (!e.adresseCachee) actions.append(lien(`https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}&travelmode=driving`, "Itinéraire ↗", "btn sec"));
  corps.append(actions);

  if (e.description) corps.append(el("p", "desc", e.description));
  if (!e.certifie) {
    const n = noteNonCertifie(e);
    if (n) corps.append(n);
  }

  const proches = evenements
    .filter((x) => x.id !== e.id && x.statut !== "annule")
    .map((x) => ({ x, d: distanceKm(e, x) }))
    .filter((p) => p.d <= 25)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((p) => p.x);
  if (proches.length) {
    const liste = el("div", "proches");
    liste.append(...proches.map(carteProche));
    corps.append(el("h4", "", "À proximité"), liste);
  }
  contenu.push(corps);

  montrerPanneau(contenu, titre);
  if (carte && deplacer) carte.easeTo({ center: [e.lng, e.lat], zoom: Math.max(carte.getZoom(), 14), duration: doux ? 700 : 0 });
}

function fermerFiche(depuisHistorique = false) {
  if (PANNEAU.hidden) return;
  groupeOuvert = null;
  PANNEAU.hidden = true;
  PANNEAU.replaceChildren();
  ZONE.classList.remove("ouvert");
  document.body.classList.remove("fiche-ouverte");
  selection = null;
  if (horsPeriode) {
    horsPeriode = null;
    afficherSurCarte();
  } else marquerSelection();
  if (carte) carte.resize();
  if (ficheDansHistorique) {
    ficheDansHistorique = false;
    if (!depuisHistorique) history.back();
  }
}
addEventListener("popstate", () => fermerFiche(true));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !PANNEAU.hidden) fermerFiche();
});
deuxColonnes.addEventListener("change", () => {
  if (PANNEAU.hidden) return;
  const e = evenements.find((x) => x.id === selection) || horsPeriode;
  if (e) ouvrirFiche(e, { deplacer: false, depuisGroupe: !!groupeOuvert });
  else if (groupeOuvert) ouvrirGroupe(groupeOuvert);
});

// ================= Filtres de date =================
const puces = [...document.querySelectorAll("[data-mode]")];
const champDate = $("#autre-date");
const puceDate = $("#puce-date");
champDate.min = aujourdhui;
function choisirMode(m) {
  mode = m;
  puces.forEach((p) => {
    const oui = p.dataset.mode === m;
    p.classList.toggle("actif", oui);
    p.setAttribute("aria-pressed", oui ? "true" : "false");
  });
  puceDate.textContent = m === "date" && dateChoisie ? formatJour(dateChoisie) : "Autre date";
  fermerFiche();
  chargerEvenements();
}
puces.forEach((p) => p.dataset.mode !== "date" && p.addEventListener("click", () => choisirMode(p.dataset.mode)));
champDate.addEventListener("change", () => {
  if (!champDate.value) return;
  dateChoisie = champDate.value;
  choisirMode("date");
});
champDate.addEventListener("click", () => champDate.showPicker && champDate.showPicker());

// ================= Zoom =================
// Boutons + et − (demande d'Arnaud, 24 nov. 2026) : même pas de zoom que la molette, grisés aux limites.
function majZoom() {
  if (!carte) return;
  $("#zoom-plus").disabled = carte.getZoom() >= carte.getMaxZoom() - 0.01;
  // Dézoomer ne sert plus quand la carte montre déjà toute la zone permise (la Belgique et ses environs).
  const vue = carte.getBounds();
  const zone = carte.getMaxBounds();
  const toutVu = zone && (vue.getEast() - vue.getWest() >= zone.getEast() - zone.getWest() - 0.05 || vue.getNorth() - vue.getSouth() >= zone.getNorth() - zone.getSouth() - 0.05);
  $("#zoom-moins").disabled = carte.getZoom() <= carte.getMinZoom() + 0.01 || !!toutVu;
}
$("#zoom-plus").addEventListener("click", () => carte?.zoomIn({ duration: doux ? 300 : 0 }));
$("#zoom-moins").addEventListener("click", () => carte?.zoomOut({ duration: doux ? 300 : 0 }));

// ================= Recherche (villages et événements) =================
const champ = $("#q");
const sugg = $("#suggestions");
let lieux = null;
let tRecherche;
let choixActif = -1;
let rechercheNo = 0;

async function chargerLieux() {
  if (!lieux) lieux = fetch("/apercu-6vqdt5j6tp/assets/carte/lieux-be.json").then((r) => r.json()).then(lireLieux);
  return lieux;
}
function fermerSuggestions() {
  sugg.hidden = true;
  champ.setAttribute("aria-expanded", "false");
  choixActif = -1;
}
function boutonsSugg() {
  return [...sugg.querySelectorAll("button")];
}
function surligner(i) {
  const bs = boutonsSugg();
  choixActif = bs.length ? (i + bs.length) % bs.length : -1;
  bs.forEach((b, j) => b.setAttribute("aria-selected", j === choixActif ? "true" : "false"));
  if (choixActif >= 0) bs[choixActif].scrollIntoView({ block: "nearest" });
}
async function rechercher() {
  const q = champ.value.trim();
  const n = ++rechercheNo;
  if (q.length < 2) return fermerSuggestions();
  const [ls, evs] = await Promise.all([
    chargerLieux().then((l) => chercherLieux(q, l, 5)).catch(() => []),
    api(`rpc/chercher_evenements?select=${COLONNES}`, { method: "POST", body: JSON.stringify({ q: q.slice(0, 80), depuis: aujourdhui }) })
      .then((r) => r.map(depuisLigne))
      .catch(() => []),
  ]);
  if (n !== rechercheNo) return;
  const items = [];
  if (ls.length) {
    items.push(el("li", "groupe", "Villages"));
    for (const l of ls) {
      const li = el("li");
      li.setAttribute("role", "presentation");
      const b = el("button");
      b.type = "button";
      b.setAttribute("role", "option");
      b.append(el("span", "", libelleLieu(l)));
      b.addEventListener("click", () => {
        champ.value = libelleLieu(l);
        fermerSuggestions();
        if (carte) carte.flyTo({ center: [l.lng, l.lat], zoom: l.estCommune ? 12.5 : 14, duration: doux ? 900 : 0 });
      });
      li.append(b);
      items.push(li);
    }
  }
  if (evs.length) {
    items.push(el("li", "groupe", "Événements"));
    for (const e of evs) {
      const li = el("li");
      li.setAttribute("role", "presentation");
      const b = el("button");
      b.type = "button";
      b.setAttribute("role", "option");
      const t = el("span");
      t.append(el("span", "", e.titre), el("br"), el("small", "", `${pastilleDate(e, aujourdhui)} · ${e.village}`));
      b.append(ico(e.categorie, true), t);
      b.addEventListener("click", () => {
        fermerSuggestions();
        ouvrirFiche(e, { deplacer: true });
      });
      li.append(b);
      items.push(li);
    }
  }
  if (!items.length) items.push(el("li", "vide", "Aucun village ni événement à venir ne correspond."));
  sugg.replaceChildren(...items);
  sugg.hidden = false;
  champ.setAttribute("aria-expanded", "true");
  choixActif = -1;
}
champ.addEventListener("focus", () => chargerLieux().catch(() => undefined), { once: true });
champ.addEventListener("input", () => {
  clearTimeout(tRecherche);
  tRecherche = setTimeout(rechercher, 220);
});
champ.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); surligner(choixActif + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); surligner(choixActif - 1); }
  else if (e.key === "Enter") {
    e.preventDefault();
    const bs = boutonsSugg();
    if (bs.length) bs[Math.max(0, choixActif)].click();
  } else if (e.key === "Escape") fermerSuggestions();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".recherche")) fermerSuggestions();
});

// La carte ne se prépare que lorsqu'elle approche de l'écran (le haut de la page reste léger).
const blocCarte = $("#map");
let demarree = false;
const demarrer = () => {
  if (demarree) return;
  demarree = true;
  demarrerCarte();
  chargerEvenements();
};
// Lien « Voir sur la carte » de la page Mon compte : /?e=<id>#carte ouvre la fiche de cet événement.
let aCentrer = null;
const idLien = new URLSearchParams(location.search).get("e");
if (idLien && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idLien)) {
  demarrer();
  api(`evenements?select=${COLONNES}&id=eq.${idLien}&visibilite=eq.visible`)
    .then((lignes) => {
      if (!lignes[0]) return;
      const e = depuisLigne(lignes[0]);
      aCentrer = e;
      ouvrirFiche(e, { deplacer: true });
      blocCarte.scrollIntoView({ block: "start" });
    })
    .catch(() => undefined);
}
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entrees) => {
    if (entrees.some((x) => x.isIntersecting)) {
      io.disconnect();
      demarrer();
    }
  }, { rootMargin: "600px 0px" });
  io.observe(blocCarte);
} else demarrer();
