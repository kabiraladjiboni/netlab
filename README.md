# Abòrò Labs

> **Les réseaux prennent vie.** — Explore. Comprends. Expérimente.
> Communauté : *Abòrò, on explore ensemble !*

Plateforme pédagogique interactive pour **comprendre comment fonctionne Internet** : animations pas à pas des paquets (DNS, ARP, NAT/PAT, TCP, TLS, DHCP, VLAN…), catalogue de protocoles, modèles OSI et TCP/IP, types de réseaux, équipements, cours Wireshark, exercices de diagnostic, quiz et assistant.

Ce n'est **pas** un émulateur réseau (ni Packet Tracer, ni GNS3) : les échanges sont des scénarios pédagogiques déterministes, construits pour être exacts et lisibles.

## Stack

| Côté | Technologies |
| --- | --- |
| Backend | PHP ≥ 8.3, Laravel 13, Inertia.js 3 (inertia-laravel), Guzzle |
| Frontend | React 19 + TypeScript, Vite 8, Tailwind CSS 4, composants Radix (style shadcn/ui), Motion, Lucide |
| Base de données | SQLite par défaut (compatible MySQL/MariaDB/PostgreSQL) |
| Tests | PHPUnit 12 (PHP), Vitest + Testing Library (TS) |

## Installation (Windows avec Laravel Herd, macOS ou Linux)

Prérequis : PHP 8.3+ (extensions pdo_sqlite, mbstring, intl recommandée), Composer 2, Node.js 20+ et npm.

```bash
cd netlab-explorer
composer install
npm install
cp .env.example .env          # Windows : copy .env.example .env
php artisan key:generate
php -r "file_exists('database/database.sqlite') || touch('database/database.sqlite');"
php artisan migrate --seed    # tables + contenu pédagogique initial
php artisan storage:link      # pour le logo téléversé depuis l'administration
npm run build
php artisan netlab:admin ton.adresse@exemple.com   # crée TON compte administrateur (mot de passe demandé, masqué)
```

`npm run build` construit deux paquets : le site (`public/build`) et le rendu serveur (`bootstrap/ssr`).

**Premier accès à l’administration** : la double authentification y est obligatoire. Au premier passage sur `/admin`, tu es guidé vers *Mon espace → Sécurité* pour scanner un QR code avec une application (Google Authenticator, Microsoft Authenticator, Aegis, 2FAS…). Range les 8 codes de secours affichés. En cas de perte du téléphone *et* des codes : `php artisan netlab:2fa-reset ton.adresse@exemple.com` (sur le serveur).

Raccourci : `composer run setup` (puis `php artisan netlab:admin …`).

### Lancer l'application

- **Avec Herd** : le dossier dans `~/Herd` est servi sur `http://netlab-explorer.test`. Lance `npm run dev` pendant le développement.
- **Sans Herd** : `php artisan serve` et `npm run dev`, puis `http://127.0.0.1:8000`.
- **Rendu serveur (SSR, pour le référencement)** : `php artisan inertia:start-ssr` dans un terminal séparé. Sans lui, le site fonctionne quand même (rendu dans le navigateur, balises SEO toujours présentes).
- **Tâches planifiées** (purge des données de mesure) : `php artisan schedule:work` en local, ou une tâche cron `* * * * * php artisan schedule:run` en production.

### Nom de la plateforme et adresse du site (`.env`)

```dotenv
APP_NAME="Abòrò Labs"
APP_URL=http://netlab-explorer.test   # l'adresse exacte servie par Herd (sinon les liens des e-mails pointent ailleurs)
```

Le nom affiché peut aussi être changé dans *Administration → Paramètres* (rubrique Marque : nom, slogan, histoire, sens du mot « Abòrò »).

### E-mails (vérification d'adresse, mot de passe oublié)

Par défaut `MAIL_MAILER=log` : les e-mails ne partent pas, ils sont écrits dans `storage/logs/laravel.log` (le lien de vérification s'y trouve). En production, renseigne un vrai serveur SMTP dans `.env` (`MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`).

**Lien de confirmation.** Le lien fonctionne même s'il est ouvert dans un autre navigateur ou après expiration de la session : l'adresse est confirmée, puis
- si la personne est déjà connectée, elle arrive sur son tableau de bord (ou sur le TP qu'elle voulait ouvrir) ;
- sinon, elle arrive sur la page de connexion avec **son e-mail déjà rempli** ; le mot de passe n'est jamais pré-rempli par le site (le gestionnaire de mots de passe du navigateur peut le faire).

## Identité visuelle

Le **kit de marque complet** (logos SVG/PNG, icônes, visuels réseaux sociaux, palette) et la **charte graphique PDF** sont livrés à part, dans `docs/marque/`.

| Fichier | Usage |
| --- | --- |
| `public/brand/og/aboro-labs-partage-1200x630.jpg` | image d’aperçu des liens partagés (Open Graph) |
| `public/brand/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `public/apple-touch-icon.png`, `public/favicon.ico` | icônes d’application et de navigateur |
| `public/brand/aboro-labs-icon.svg` | icône couleur (aussi `public/favicon.svg`) |
| `public/brand/aboro-labs-icon-mono.svg` | icône monochrome (tampons, impressions) |
| `public/brand/aboro-labs-logo-dark.svg` / `-light.svg` | logo complet avec nom et slogan, fond sombre / clair |
| `resources/js/components/layout/logo.tsx` | composants `Logo` et `BrandName` utilisés dans l'interface |

Le logo est un « A » dessiné comme un petit réseau : des nœuds reliés (les amis, la communauté), une barre dorée qui les unit, et un paquet qui circule. Palette : bleu nuit `#101D35`, turquoise `#45D6C5`, or solaire `#F3B75E`, blanc brume `#F4F7FB`, ardoise `#27364B`.

La page `/notre-histoire` présente la mission, la vision et le sens du mot « Abòrò » (amitié, convivialité, apprendre ensemble).

## Mise en production

> **Hébergement gratuit pas à pas (Render + Neon, sans laisser ton PC allumé)** : voir [docs/DEPLOIEMENT-GRATUIT.md](docs/DEPLOIEMENT-GRATUIT.md). Le projet contient un `Dockerfile` et un `render.yaml` prêts à l’emploi.

1. `.env` :

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://ton-domaine
LOG_LEVEL=warning
SESSION_ENCRYPT=true
MAIL_MAILER=smtp            # + MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS
# Réglages de sécurité (valeurs par défaut conseillées, modifiables seulement ici) :
NETLAB_CSP=enforce          # report pour observer sans bloquer, off pour désactiver (déconseillé)
NETLAB_ADMIN_2FA=true       # double authentification obligatoire pour l'administration
NETLAB_BREACHED_PASSWORDS=true
```

2. `composer install --no-dev --optimize-autoloader`, `npm ci && npm run build`, `php artisan migrate --force`, puis `php artisan config:cache route:cache view:cache`.
3. **Serveur SSR permanent** (Supervisor, par exemple) :

```ini
[program:aboro-ssr]
command=php /chemin/du/site/artisan inertia:start-ssr
autostart=true
autorestart=true
user=www-data
```

Après chaque déploiement : `php artisan inertia:stop-ssr` (Supervisor le relance avec le nouveau code).

4. **Serveur web** : seul `public/` est exposé ; HTTPS obligatoire ; cache long pour les fichiers versionnés, par exemple avec nginx : `location /build/ { add_header Cache-Control "public, max-age=31536000, immutable"; }`.
5. `php artisan netlab:security-check` : tous les points doivent être verts.
6. Référencement : déclare le site dans Google Search Console et Bing Webmaster Tools et soumets `https://ton-domaine/sitemap.xml` (voir [docs/AUDIT-SEO.md](docs/AUDIT-SEO.md)).

## Sécurité et référencement

- **Sécurité** (OWASP Top 10 / ASVS) : CSP stricte avec nonce, HSTS, cookies `__Host-` chiffrés, double authentification TOTP, politique de mots de passe ASVS (12 caractères minimum, mots de passe divulgués refusés), journal de sécurité sans données personnelles en clair, exports CSV protégés, `security.txt`. Détails : [docs/AUDIT-SECURITE.md](docs/AUDIT-SECURITE.md) et [SECURITY.md](SECURITY.md).
- **Référencement** : rendu serveur, titre, description et URL canonique propres à chaque page, Open Graph/Twitter, données structurées schema.org, `sitemap.xml`, `robots.txt`, manifeste et icônes. Détails : [docs/AUDIT-SEO.md](docs/AUDIT-SEO.md).

## Les espaces de la plateforme

| Espace | Accès | Adresses |
| --- | --- | --- |
| Site public | sans compte | `/`, `/notre-histoire`, `/apprendre`, `/cours/{slug}`, `/lecons/{slug}` (aperçu animé limité), `/protocoles`, `/modeles/…`, `/reseaux`, `/wireshark`, `/dictionnaire`, `/laboratoire` (catalogue) |
| Comptes | — | `/connexion`, `/inscription`, `/mot-de-passe-oublie`, `/email/verification` |
| Espace étudiant | compte | `/app` (tableau de bord), `/app/ma-progression`, `/app/mes-resultats`, `/app/mes-favoris`, `/app/mon-historique`, `/app/mon-profil`, `/app/parametres` |
| Laboratoire (TP) | compte + e-mail vérifié (réglable) | `/laboratoire/{slug}`, `/laboratoire/{slug}/resultats`, diagnostics complets |
| Administration | rôle administrateur (contrôlé côté serveur) | `/admin/…` : tableau de bord, audience, apprentissage, utilisateurs, cours/chapitres, protocoles, glossaire, scénarios, quiz, diagnostics, retours, évaluations, journal, paramètres |

Rôles : **étudiant** (par défaut) et **administrateur**. Le rôle n'est jamais modifiable par un formulaire étudiant ; il se donne par `php artisan netlab:admin email` ou depuis l'administration (confirmation par mot de passe, journalisé). L'architecture (constante `User::ROLES`, middleware) permet d'ajouter plus tard un rôle enseignant.

Un visiteur qui clique sur « Commencer gratuitement » est envoyé vers l'inscription puis ramené **directement au TP** (destination conservée, uniquement des adresses internes).

## Mesure d'audience et confidentialité

Définitions affichées dans l'administration :

- **Session active maintenant** : session ayant envoyé un signal dans la fenêtre d'activité (5 min par défaut, réglable). Le navigateur n'envoie un battement que si l'onglet est visible et utilisé depuis moins de 2 min.
- **Étudiant actif (période)** : compte ayant fait au moins une action sur la période.
- **Visiteurs uniques** : somme des visiteurs uniques de chaque jour (empreinte hachée avec un sel renouvelé chaque jour, visiteurs consentants uniquement).
- **TP terminé** : toutes les étapes vues (scénario) ou cause trouvée (diagnostic). Un TP simplement démarré n'est jamais compté comme terminé.

Règles de collecte :

- Aucune adresse IP n'est enregistrée (vérifié par les tests).
- Sans consentement : seules des pages vues anonymes sont comptées.
- Avec consentement (bandeau, jamais présumé) : identifiant de session aléatoire, empreinte quotidienne, pays estimé.
- Les données de mesure sont purgées après 180 jours par défaut (`netlab:analytics-purge`, réglable de 30 à 395 jours).

**Pays estimé (gratuit, sans service tiers).** Télécharge le fichier gratuit « IP to Country Lite » (format CSV) de DB-IP : https://db-ip.com/db/download/ip-to-country-lite (licence CC BY 4.0, mentionner « IP Geolocation by DB-IP »). Puis :

```bash
php artisan netlab:geoip-import chemin/vers/dbip-country-lite-AAAA-MM.csv.gz
```

À refaire chaque mois. Derrière Cloudflare, tu peux plutôt définir `NETLAB_GEO_HEADER=CF-IPCountry`.

**À faire avant une mise en ligne publique.** Les pages `/confidentialite` et `/conditions` décrivent le fonctionnement réel de la plateforme, mais elles doivent être complétées (identité de l'éditeur, adresse de contact dans *Paramètres*) et validées par un juriste. Au Bénin, le cadre de référence est le Code du numérique (loi n° 2017-20) et l'APDP ; si tu vises aussi des étudiants dans l'UE, le RGPD s'applique.

## Données de démonstration (développement uniquement)

```bash
php artisan netlab:demo            # 40 étudiants fictifs @demo.netlab.test, séances, quiz, visites
php artisan netlab:demo --remove   # les supprimer
```

La commande refuse de s'exécuter hors environnement `local`. L'administration affiche un avertissement tant que ces comptes existent.

## Contenu pédagogique

Tout le contenu est dans `database/content/` (JSON, source de vérité) :

| Fichier | Contenu |
| --- | --- |
| `categories.json`, `layers.json` | familles de protocoles, couches OSI et TCP/IP |
| `protocols/*.json` | fiches protocoles (89 entrées, dont 31 fiches complètes ; les autres sont marquées « fiche à compléter ») |
| `terms.json` | dictionnaire technique (popovers contextuels) |
| `network-types.json`, `equipment.json` | types de réseaux, équipements |
| `lessons.json`, `quizzes.json`, `diagnostics.json`, `faq.json` | leçons, quiz, exercices, base de réponses de l'assistant |

Ces fichiers servent à **initialiser** la base. Ensuite, le contenu se gère dans l'administration (cours, chapitres, fiches, glossaire, quiz, diagnostics, scénarios), avec brouillons, prévisualisation et publication. `php artisan netlab:content` refuse d'écraser un contenu existant ; `--force` remplace tout par les fichiers JSON, et les modifications faites dans l'administration sont alors perdues. Les progressions des étudiants ne sont jamais supprimées : elles référencent les contenus par leur identifiant.

Les **animations intégrées** sont décrites en TypeScript dans `resources/js/scenarios/` et jouées par le moteur générique `resources/js/engine/`. L'administration permet aussi de créer des **scénarios personnalisés** en JSON (même format), avec validation en direct, test immédiat et publication seulement s'ils sont valides. Aucun code n'est exécuté. Les **captures Wireshark pédagogiques** sont dans `resources/js/wireshark/captures.ts`.

Conventions : adresses publiques de documentation (RFC 5737 : 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), MAC de documentation (RFC 7042 : 00:00:5e:00:53:xx), domaine `www.example.com`. Les valeurs sont illustratives et le signalent à l'écran.

## Assistant IA

Par défaut (`NETLAB_AI_PROVIDER=none`), l'assistant répond à partir de la base de connaissances locale (FAQ, dictionnaire, fiches) et l'indique clairement. Pour brancher un modèle, dans `.env` uniquement (jamais dans le frontend) :

```dotenv
NETLAB_AI_PROVIDER=anthropic     # ou openai
NETLAB_AI_API_KEY=ta_cle
NETLAB_AI_MODEL=                 # optionnel, sinon valeur par défaut de config/netlab.php
```

puis `php artisan config:clear`. Les appels partent du serveur (`POST /api/assistant`), avec limitation de débit (12/min, 300/jour par IP). En cas d'erreur du fournisseur, on retombe sur la base locale.

## Tests et vérifications

```bash
php artisan test          # 129 tests : comptes, droits, 2FA, sécurité, SEO, TP, quiz, diagnostics, administration, mesure d'audience, contenu
npm test                  # moteur d'animation, scénarios, filtres Wireshark, lecteur PCAP, calculs CIDR, robustesse des mots de passe
php artisan netlab:security-check   # configuration de sécurité
npm run types:check       # TypeScript strict
npm run build
```

## Architecture

```
app/
  Console/Commands/ImportContent.php    php artisan netlab:content
  Http/Controllers/                     pages Inertia + API (recherche, termes, assistant)
  Services/Content/                     import/validation du contenu, générateur de quiz
  Services/Assistant/                   drivers Anthropic/OpenAI + base de connaissances
  Services/Search/                      recherche globale
database/content/                       contenu JSON
resources/js/
  engine/                               moteur d'animation (timeline, état, validation)
  scenarios/                            scénarios réseau
  wireshark/                            captures, filtres d'affichage, lecteur PCAP/PCAPNG
  components/  pages/  hooks/  lib/
```

## Limites connues

- Les animations sont des **scénarios pédagogiques**, pas une simulation de trafic réel.
- Le filtre d'affichage Wireshark couvre un **sous-ensemble** de la syntaxe. L'import PCAP fait une analyse basique dans le navigateur, sans réassemblage ni déchiffrement.
- **Quiz et diagnostics** : le score est recalculé par le serveur. Les quiz restent formatifs : la correction d'une question s'affiche dès qu'elle est validée. La réponse d'un diagnostic n'est envoyée qu'après la bonne réponse ou deux essais.
- **Scénarios personnalisés** : l'édition se fait en JSON, avec un éditeur rapide des titres et textes. Il n'y a pas encore d'éditeur graphique de topologie.
- La langue de l'interface est le français uniquement.
- **Fiches protocoles** : 58 sont encore « essentielles », à enrichir.
- **Pays estimé** : nécessite l'import de la base DB-IP, ou un proxy qui fournit le pays.
- **Envoi des e-mails** : nécessite un serveur SMTP en production.

## Note sur les dépendances

Le projet est livré sans `vendor/`, `node_modules/` ni `composer.lock` : `composer install` résout les versions depuis Packagist et crée le lock à la première installation (versions testées : Laravel 13.17, inertia-laravel 3, PHPUnit 12.5).
