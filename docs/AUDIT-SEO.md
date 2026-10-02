# Audit SEO — Abòrò Labs

Version 2.3 · octobre 2026

## 1. Constat avant correction

| # | Point contrôlé | Constat | Gravité |
| --- | --- | --- | --- |
| 1 | Contenu lisible par les robots | Application monopage : le HTML envoyé ne contenait que `<div id="app" data-page="…">`, sans aucun texte visible. Les robots qui n’exécutent pas JavaScript (aperçus WhatsApp, Facebook et LinkedIn, plusieurs moteurs) ne voyaient rien. Google devait passer par une seconde file de rendu, plus lente. | Critique |
| 2 | Titres et descriptions | Un seul titre (« Abòrò Labs ») et une seule meta description pour toutes les pages. Les titres propres à chaque page n’apparaissaient qu’après l’exécution du JavaScript. | Critique |
| 3 | URL canonique | Absente. Les variantes `?couche=`, `?type=` et `?equipement=` pouvaient être vues comme des doublons. | Important |
| 4 | Partage social | Aucune balise Open Graph ni Twitter. Un lien partagé sur WhatsApp ou Facebook s’affichait sans image ni résumé. | Important |
| 5 | Données structurées | Aucune. | Important |
| 6 | robots.txt / sitemap | `robots.txt` vide (tout était autorisé, y compris `/admin`, `/app` et `/api`). Pas de `sitemap.xml`. | Important |
| 7 | Pages privées | Connexion, inscription et espace étudiant étaient indexables. | Moyen |
| 8 | Icônes | Pas de `favicon.ico`, d’icône Apple, ni de manifeste d’application. | Moyen |
| 9 | Page 404 | Page Laravel par défaut, sans lien de retour. | Faible |

Les points forts déjà présents :

- `lang="fr"` ;
- une seule balise `<h1>` par page ;
- des URL lisibles en français ;
- un contenu riche (89 fiches protocoles, 82 termes, leçons, diagnostics) ;
- un bon maillage interne ;
- des images avec texte alternatif ;
- des polices hébergées sur le site ;
- un code découpé page par page.

## 2. Corrections appliquées

### Rendu côté serveur (SSR)

Les pages publiques sont maintenant rendues en HTML complet par le serveur (Inertia SSR). Par exemple, une fiche protocole contient environ 2 000 mots lisibles sans JavaScript. Ensuite, React reprend la main dans le navigateur (hydratation) sans rien recharger.

L’hydratation a été vérifiée sur une vingtaine de pages publiques et privées, en thème clair et sombre et en largeur mobile : aucune différence entre le rendu serveur et le rendu du navigateur.

Les espaces privés (`/app`, `/admin`, TP) restent rendus dans le navigateur : ils n’ont pas d’intérêt pour le référencement.

Si le serveur SSR est arrêté, le site continue de fonctionner normalement. Les balises de référencement restent alors posées par `app.blade.php`.

### Balises par page (`App\Support\Seo\Seo`)

Chaque contrôleur public décrit sa page. Le serveur produit alors les balises suivantes :

- `<title>` : un titre unique, orienté recherche. Exemple : « DNS (Domain Name System) : rôle, port 53 et fonctionnement » ;
- `meta description` : 160 caractères maximum, unique pour chaque page (vérifié par un test) ;
- `link rel="canonical"` : le chemin sans paramètres ;
- `meta robots` : `index, follow, max-image-preview:large` pour les pages publiques, `noindex` pour les pages privées ;
- Open Graph et Twitter : titre, description, image de partage 1200 × 630, `og:locale fr_FR`.

Toutes ces balises portent une clé `data-inertia` stable. Inertia les met donc à jour à chaque navigation, sans créer de doublon.

### Données structurées schema.org (JSON-LD)

| Page | Types |
| --- | --- |
| Toutes | `EducationalOrganization`, `WebSite`, `WebPage`, `BreadcrumbList` (fil d’Ariane) |
| Fiche protocole | `TechArticle` (date de modification, sujet) |
| Leçon | `LearningResource` (durée, notions enseignées, cours parent) |
| Cours | `Course` (gratuit, en ligne, charge de travail) |
| Dictionnaire / terme | `DefinedTermSet` / `DefinedTerm` |
| Quiz | `Quiz` |
| Catalogue, laboratoire, parcours | `CollectionPage` / `ItemList` |
| Notre histoire | `AboutPage` |

### Fichiers pour les moteurs

- `/sitemap.xml` : 223 adresses, avec la date de dernière modification. Il est généré depuis la base (seul le contenu publié y figure) et gardé en cache une heure.
- `/robots.txt` en production : il bloque `/admin`, `/app`, `/api/`, `/laboratoire/*` et les pages de compte, et il indique le sitemap.
- Hors production, il interdit tout (en plus d’un en-tête `X-Robots-Tag: noindex`), pour qu’aucun site de test ne soit jamais indexé.
- `/site.webmanifest`, `favicon.ico` (16, 32 et 48 px), `favicon.svg`, `apple-touch-icon.png` et des icônes Android 192/512 px, dont une version adaptative.

### Expérience

- Des pages d’erreur aux couleurs de la marque (404, 403, 419, 429, 500, 503), avec des liens vers les rubriques principales.
- Un pied de page refait : description claire de la plateforme et liens vers toutes les rubriques (meilleur maillage interne).

## 3. À faire après la mise en ligne (je ne peux pas le faire à ta place)

1. Mettre `APP_ENV=production` et `APP_URL=https://ton-domaine` : les URL canoniques et le sitemap en dépendent.
2. Lancer le serveur SSR en permanence (`php artisan inertia:start-ssr`, avec un gestionnaire de processus comme Supervisor ; voir le README).
3. Déclarer le site dans **Google Search Console** et **Bing Webmaster Tools**, puis y soumettre `https://ton-domaine/sitemap.xml`.
4. Valider quelques pages avec le **test des résultats enrichis** de Google et le **validateur schema.org**.
5. Mesurer les performances avec Lighthouse ou PageSpeed Insights. Côté serveur : compression gzip/brotli et cache long (`immutable`) pour `/build/*`.
6. Enrichir les 58 fiches marquées « essentielles » : ce sont les pages les plus courtes, donc les moins bien placées.
7. Obtenir des liens depuis des sites reconnus : universités, écoles, communautés tech béninoises et francophones, articles invités.

Requêtes à viser en priorité, déjà couvertes par des pages dédiées :

- « modèle OSI 7 couches » ;
- « c’est quoi le DNS » ;
- « port 443 » ;
- « différence TCP UDP » ;
- « NAT PAT explication » ;
- « VLAN 802.1Q » ;
- « apprendre Wireshark » ;
- « cours réseau informatique gratuit ».

Aucune position dans Google ne peut être garantie. Ces corrections lèvent les blocages techniques ; le classement dépendra ensuite du contenu, des liens et du temps.

## 4. Vérifications effectuées

- Tests automatiques (`tests/Feature/SeoTest.php`) :
  - balises d’une fiche ;
  - rendu des balises sans SSR ;
  - descriptions uniques sur 18 pages ;
  - `noindex` des pages privées ;
  - `robots.txt` en local et en production ;
  - sitemap XML valide, sans brouillon ;
  - manifeste.
- Contrôle dans un navigateur, avec et sans serveur SSR :
  - un seul `<title>` ;
  - une seule description ;
  - une URL canonique correcte ;
  - JSON-LD valide ;
  - mise à jour des balises lors des navigations internes.
