// Commun à toutes les pages de lokalapp.be : les vraies icônes de l'appli dans les visuels, et « Remonter en haut ».
import { CATEGORIES, svgIcone, SUPABASE_URL } from "./lokal.js?v=cff84955b0";

document.querySelectorAll("[data-icone]").forEach((n) => {
  const cat = n.getAttribute("data-icone");
  if (!CATEGORIES[cat]) return;
  n.style.background = CATEGORIES[cat].couleur;
  n.innerHTML = svgIcone(cat); // texte fixe de l'appli, jamais une donnée
});

const haut = document.getElementById("haut");
if (haut) {
  haut.addEventListener("click", () => {
    const doux = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: doux ? "smooth" : "auto" });
    document.querySelector(".marque")?.focus({ preventScroll: true });
  });
}

// En-tête : « Mon compte » au lieu de « Se connecter » quand ce navigateur garde une session Lokal
// (la clé de connexion du site, voir la politique de confidentialité). Lecture seule, rien n'est envoyé.
const lienCompte = document.getElementById("lien-compte");
if (lienCompte) {
  try {
    const cle = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
    const session = JSON.parse(localStorage.getItem(cle) || "null");
    if (session?.user && !session.user.is_anonymous) lienCompte.textContent = "Mon compte";
  } catch {
    // stockage bloqué : on garde « Se connecter »
  }
}
