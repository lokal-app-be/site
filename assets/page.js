// Commun à toutes les pages de lokalapp.be : les vraies icônes de l'appli dans les visuels, et « Remonter en haut ».
import { CATEGORIES, svgIcone } from "./lokal.js";

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
