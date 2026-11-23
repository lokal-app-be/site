# Site lokalapp.be

Dépôt `lokal-app-be/site`, publié par GitHub Pages (gratuit). La branche `main` est le site en ligne :
rien n'y arrive sans l'accord écrit d'Arnaud dans le fil du site.

## Les pages

- `index.html` : accueil (carrousel, carte des événements, fiche d'un événement).
- `organisateurs.html`, `communes.html` : pour les organisateurs, et pour les communes et les salles (sur devis).
- `ajouter.html` : ajouter un événement depuis le site, avec son compte Lokal (le même que dans l'appli).
- `admin.html` : Admin Lokal et page Fondateur, réservés à l'équipe (la base vérifie le rôle à chaque lecture).
- `conditions.html`, `confidentialite.html`, `mentions-legales.html`, `supprimer-compte.html` : pages légales
  (`/supprimer-compte` est demandée par Google Play : ne jamais la casser).
- `404.html` : page « Lokal arrive bientôt », renvoyée pour toute adresse inconnue, y compris les liens partagés depuis l'appli
  (`/e/…`, `/o/…`, `/lieu/…`, `/c/…`, `/i/…`). Tant que l'appli n'est pas sur les stores, le site ne renvoie pas vers l'appli
  (décision d'Arnaud, 19 novembre 2026).
- `CNAME`, `robots.txt`, `sitemap.xml`, `partage.png` : le domaine, Google, l'image de partage.

## Les outils (`assets/`)

- `lokal.js` : repris de l'appli (types, icônes, dates à l'heure belge, recherche de villages).
- `compte.js` : connexion au compte Lokal (Supabase, Francfort). Clé « publishable » seulement : ce sont les règles d'accès de la base qui protègent.
- `formulaire.js`, `admin-lib.js` : les règles du formulaire et de l'Admin de l'appli, sans écran.
- `supabase/`, `maplibre/` : bibliothèques copiées à une version précise (pas de service externe pour les charger).

## Tests

```
node --test tests/*.test.mjs
```

Ils vérifient les règles reprises de l'appli, et sur chaque page : les règles de sécurité du navigateur (CSP),
aucune clé secrète, aucun lien vers l'appli ou les stores avant la sortie, mêmes en-tête et pied de page.
