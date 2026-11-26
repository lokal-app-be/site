// Connexion au compte Lokal sur le site : le même compte que dans l'appli (Supabase, serveurs à Francfort).
// La clé est la clé « publishable » de l'appli : publique par nature, ce sont les règles d'accès (RLS) qui protègent.
// La session est gardée dans ce navigateur (stockage local), comme « rester connecté » dans l'appli.
import { SUPABASE_URL, SUPABASE_CLE } from "./lokal.js";

let client = null;
export function sb() {
  if (!client) {
    if (!window.supabase?.createClient) throw new Error("Supabase n'est pas chargé");
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_CLE, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
  }
  return client;
}

// ---- Règles reprises de l'appli (mêmes messages) ----
export const emailValide = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim());
export const motDePasseValide = (s) => String(s).length >= 8;
export const PSEUDO_MIN = 3;

export function verifierInscription(v) {
  if (!v.prenom.trim()) return "Ajoute ton prénom.";
  if (!v.nom.trim()) return "Ajoute ton nom.";
  if (!emailValide(v.email)) return "Cet e-mail n'a pas l'air correct.";
  if (!motDePasseValide(v.motDePasse)) return "Ton mot de passe doit avoir au moins 8 caractères.";
  return problemePseudo(v.pseudo || "");
}

export function problemePseudo(p) {
  if (!p.trim()) return null;
  if (p.includes("@")) return "C'est une adresse e-mail. Ton pseudo est visible par tout le monde : choisis plutôt un surnom (ex. : lulu_bure).";
  if (p.trim().length < PSEUDO_MIN) return `Ton pseudo doit avoir au moins ${PSEUDO_MIN} caractères.`;
  return null;
}

export function nomPublic(p) {
  if (!p) return "Invité Lokal";
  if (p.pseudo && p.pseudo.trim()) return p.pseudo.trim();
  return `${p.prenom.trim()} ${p.nom.trim().charAt(0).toUpperCase()}.`;
}

export function profilDepuisFournisseur(meta) {
  const txt = (k) => (typeof meta?.[k] === "string" ? meta[k].trim() : "");
  let prenom = txt("given_name") || txt("first_name");
  let nom = txt("family_name") || txt("last_name");
  if (!prenom || !nom) {
    const complet = (txt("full_name") || txt("name")).split(/\s+/).filter(Boolean);
    if (complet.length >= 2) {
      prenom = prenom || complet[0];
      nom = nom || complet.slice(1).join(" ");
    }
  }
  if (!prenom || !nom) return null;
  return { prenom: prenom.slice(0, 24), nom: nom.slice(0, 30), pseudo: null };
}

export function messageErreurCompte(e) {
  const m = e && typeof e === "object" && "message" in e ? String(e.message) : "";
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  if (code === "invalid_credentials" || /Invalid login/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (code === "email_not_confirmed" || /not confirmed/i.test(m))
    return "Ton e-mail n'est pas encore confirmé. Crée ton compte à nouveau avec le même e-mail : un nouveau code t'arrive.";
  if (code === "user_already_exists" || code === "email_exists" || /already (registered|been registered)/i.test(m))
    return "Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.";
  if (code === "same_password") return "Choisis un mot de passe différent de l'ancien.";
  if (code === "weak_password" || /password/i.test(m)) return "Mot de passe trop faible : 8 caractères minimum.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || /rate limit/i.test(m)) return "Trop d'essais. Attends quelques minutes.";
  if (code === "otp_expired" || /expired|invalid.*(otp|token)|token.*(expired|invalid)/i.test(m)) return "Ce code n'est pas bon ou a expiré. Vérifie-le, ou demande un nouveau code.";
  if (/network|fetch|Failed/i.test(m)) return "Pas de connexion. Vérifie ton internet et réessaie.";
  return "Ça n'a pas marché. Réessaie dans un instant.";
}

// ---- Session ----
// Le compte connecté, avec son profil (prénom, nom, pseudo). null : personne, ou un invité de l'appli.
export async function moi() {
  const { data } = await sb().auth.getSession();
  const u = data.session?.user;
  if (!u || u.is_anonymous) return null;
  let { data: p } = await sb().from("profils").select("prenom,nom,pseudo").eq("id", u.id).maybeSingle();
  // Première connexion avec Google ou Facebook : le profil se crée avec le prénom et le nom du fournisseur (comme l'appli).
  if (!p) {
    const nouveau = profilDepuisFournisseur({ ...(u.user_metadata ?? {}), ...(u.identities?.[0]?.identity_data ?? {}) });
    if (nouveau) {
      const { error } = await sb().from("profils").upsert({ id: u.id, ...nouveau });
      if (!error) p = nouveau;
    }
  }
  return { id: u.id, email: u.email ?? "", fournisseur: u.app_metadata?.provider ?? "email", profil: p ?? null, nom: nomPublic(p) };
}

export async function seConnecter(email, motDePasse) {
  const r = await sb().auth.signInWithPassword({ email: email.trim(), password: motDePasse });
  if (r.error) throw r.error;
}

// Google ou Facebook : on part chez le fournisseur, puis on revient sur la même page du site.
export async function connexionSociale(fournisseur) {
  const retour = location.origin + location.pathname;
  const r = await sb().auth.signInWithOAuth({ provider: fournisseur, options: { redirectTo: retour } });
  if (r.error) throw r.error;
}

// Se déconnecter du site seulement : l'appli sur le téléphone reste connectée (et n'a pas à redemander le code admin).
export async function seDeconnecter() {
  await sb().auth.signOut({ scope: "local" });
}

// Créer un compte : le code à 6 chiffres arrive par e-mail (comme dans l'appli).
let attente = null;
export async function creerCompte(v) {
  const r = await sb().auth.signUp({ email: v.email.trim(), password: v.motDePasse });
  if (r.error) throw r.error;
  if (!r.data.user) throw new Error("Compte créé mais pas de session");
  if (!r.data.session && r.data.user.identities?.length === 0) throw { code: "user_already_exists", message: "already registered" };
  attente = v;
  if (r.data.session) return terminerInscription(r.data.user.id);
  return "code";
}

export async function confirmerCode(code) {
  if (!attente) throw new Error("Pas d'inscription en cours");
  const v = await sb().auth.verifyOtp({ email: attente.email.trim(), token: code.trim(), type: "email" });
  if (v.error) throw v.error;
  const { data } = await sb().auth.getUser();
  const id = data.user?.id ?? v.data.user?.id;
  if (!id) throw new Error("Pas de session");
  return terminerInscription(id);
}

export async function renvoyerCode() {
  if (!attente) throw new Error("Pas d'inscription en cours");
  const r = await sb().auth.resend({ type: "signup", email: attente.email.trim() });
  if (r.error) throw r.error;
}

// Le profil : le pseudo est vérifié par la base (unique). S'il a été pris entre-temps, le compte est créé
// sans pseudo, comme dans l'appli ; il se choisit ensuite dans « Modifier mon profil ».
async function terminerInscription(id) {
  const v = attente;
  const ligne = { id, prenom: v.prenom.trim(), nom: v.nom.trim(), pseudo: v.pseudo && v.pseudo.trim() ? v.pseudo.trim() : null };
  let { error } = await sb().from("profils").upsert(ligne);
  let sansPseudo = false;
  if (error && ligne.pseudo) {
    ({ error } = await sb().from("profils").upsert({ ...ligne, pseudo: null }));
    sansPseudo = !error;
  }
  if (error) throw error;
  attente = null;
  return sansPseudo ? "sans-pseudo" : "ok";
}

// Mot de passe oublié : un code par e-mail, puis le nouveau mot de passe.
export async function envoyerCodeOubli(email) {
  const r = await sb().auth.resetPasswordForEmail(email.trim());
  if (r.error) throw r.error;
}
export async function nouveauMotDePasse(email, code, motDePasse) {
  const v = await sb().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "recovery" });
  if (v.error) throw v.error;
  const u = await sb().auth.updateUser({ password: motDePasse });
  if (u.error) throw u.error;
}

// ---- Mon compte : mes événements (comme « Mes événements » de l'appli) ----
// L'état affiché à côté d'un de mes événements, et s'il peut s'ouvrir sur la carte publique du site.
export function etatMien(e, aujourdhui) {
  const passe = (e.dateFin || e.date) < aujourdhui;
  if (e.visibilite === "retire") return { texte: "Retiré par l'équipe Lokal", alerte: true, carte: false, passe };
  if (e.visibilite === "masque") return { texte: "Caché pendant une vérification", alerte: true, carte: false, passe };
  if (e.statut === "annule") return { texte: "Annulé", alerte: true, carte: false, passe };
  if (passe) return { texte: "Passé", alerte: false, carte: false, passe };
  if (e.prive) return { texte: "Privé", alerte: false, carte: false, passe };
  return { texte: null, alerte: false, carte: true, passe };
}
// À venir d'abord (par date), puis les passés ; à part, « Scannés par toi » (affiches et imports).
export function trierMiens(liste, aujourdhui) {
  const passe = (e) => (e.dateFin || e.date) < aujourdhui;
  const tries = [...liste].sort((a, b) => Number(passe(a)) - Number(passe(b)) || `${a.date} ${a.heure || ""}`.localeCompare(`${b.date} ${b.heure || ""}`) || a.titre.localeCompare(b.titre));
  return { miens: tries.filter((e) => e.source === "appli"), scannes: tries.filter((e) => e.source !== "appli") };
}
