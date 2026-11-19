# Site lokalapp.be

Copié tel quel dans le dépôt public `lokal-app-be/site` (GitHub Pages, gratuit).

- `index.html` : accueil.
- `404.html` : page « Lokal arrive bientôt », renvoyée pour toute adresse inconnue, y compris les liens partagés depuis l'appli
  (`/e/…`, `/o/…`, `/lieu/…`, `/c/…`, `/i/…`). Tant que l'appli n'est pas sur les stores, le site ne montre aucun événement
  et ne renvoie pas vers l'appli (décision d'Arnaud, 19 novembre 2026). Les QR lus avec le lecteur de l'appli marchent toujours :
  c'est l'appli qui les lit, pas le site.
- `CNAME` : le domaine.
- `robots.txt` et `sitemap.xml` : pour Google (l'accueil et les trois pages légales ; les pages des QR restent en « noindex »).
- `partage.png` : l'image qui s'affiche quand on partage un lien lokalapp.be (WhatsApp, Facebook…).

Le site complet (lot 5) remplacera ces pages.
