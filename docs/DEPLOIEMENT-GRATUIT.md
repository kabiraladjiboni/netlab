# Mettre Abòrò Labs en ligne gratuitement (Render + Neon)

Ce guide permet d’obtenir une adresse publique du type `https://aboro-labs.onrender.com`, sans laisser ton PC allumé.

- **Render** (offre gratuite) fait tourner le site, à partir du `Dockerfile` du projet.
- **Neon** (offre gratuite) héberge la base PostgreSQL. Les comptes, la progression et les statistiques y sont conservés durablement, ce que l’offre PostgreSQL gratuite de Render ne fait pas (elle expire après 30 jours).

Le projet a été testé sur PostgreSQL (tous les tests passent), et le démarrage en mode production a été simulé derrière un proxy HTTPS.

## Limites de l’offre gratuite, à connaître

- **Mise en veille** : après environ 15 minutes sans visite, le site s’endort. La visite suivante attend 30 à 60 secondes, puis tout redevient rapide. C’est suffisant pour recueillir des avis, pas pour un lancement public.
- **Fichiers téléversés** : le disque de Render est effacé à chaque redéploiement. Un logo envoyé depuis l’administration disparaît, alors que le logo par défaut reste. Les données de la base, elles, sont conservées chez Neon.
- **Stockage de la base** : l’offre gratuite de Neon est limitée en espace et en temps de calcul. C’est largement suffisant pour un test.

## Étape 1 : le code sur GitHub

Le dépôt peut rester **privé**. Vérifie que `composer.lock` et `package-lock.json` sont bien envoyés : `git status` ne doit pas les lister comme ignorés.

## Étape 2 : la base de données (Neon)

1. Crée un compte sur **neon.com** (connexion possible avec GitHub).
2. Crée un projet `aboro-labs` :
   - région **AWS Europe Central 1 (Frankfurt)**, la plus proche de Render Frankfurt ;
   - version de PostgreSQL proposée par défaut.
3. Dans **Connect**, désactive « Connection pooling » et copie la chaîne de connexion. Elle ressemble à :
   `postgresql://utilisateur:motdepasse@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
4. Garde-la pour l’étape 4. **Ne la publie nulle part** : elle contient le mot de passe de la base.

## Étape 3 : la clé de l’application

Sur ton PC, dans le dossier du projet :

```bash
php artisan key:generate --show
```

Copie le résultat (`base64:…`).

**Cette clé ne doit jamais changer** une fois le site en ligne. Elle chiffre les sessions et les secrets de double authentification.

## Étape 4 : le site (Render)

1. Crée un compte sur **render.com** avec ton compte GitHub.
2. Choisis **New → Blueprint**, puis sélectionne ton dépôt. Render lit le fichier `render.yaml` du projet.
3. Remplis les valeurs demandées :

| Variable | Valeur |
| --- | --- |
| `APP_KEY` | la clé de l’étape 3 |
| `APP_URL` | `https://aboro-labs.onrender.com` (adapte-la si Render donne un autre nom) |
| `DB_URL` | la chaîne Neon de l’étape 2 |
| `NETLAB_ADMIN_EMAIL` | ton adresse |
| `NETLAB_ADMIN_PASSWORD` | un mot de passe d’au moins 12 caractères, utilisé une seule fois |

4. Lance le déploiement. La première construction prend 5 à 10 minutes.

Au premier démarrage, le conteneur :

- crée les tables ;
- importe le contenu pédagogique (89 fiches, 82 termes…) ;
- crée ton compte administrateur.

Si Render attribue une autre adresse que celle de `APP_URL`, corrige `APP_URL` dans **Environment**, puis choisis **Manual Deploy**.

## Étape 5 : premier accès

1. Va sur `https://ton-adresse/connexion` et connecte-toi avec l’adresse et le mot de passe choisis.
2. Le site te demande d’activer la **double authentification** : scanne le QR code et range les codes de secours.
3. Dans Render, **supprime `NETLAB_ADMIN_PASSWORD`** des variables. Le compte existe, la variable ne sert plus à rien.
4. Dans *Administration → Paramètres*, renseigne l’adresse de contact.

## Étape 6 : les e-mails (confirmation d’adresse, mot de passe oublié)

Sans serveur d’envoi, aucun e-mail ne part. Or les TP exigent par défaut une adresse confirmée. Deux possibilités :

- **Recommandé** : un compte gratuit **Brevo**. Ajoute dans Render :
  - `MAIL_MAILER=smtp`
  - `MAIL_HOST=smtp-relay.brevo.com`
  - `MAIL_PORT=587`
  - `MAIL_USERNAME` et `MAIL_PASSWORD` (fournis par Brevo)
  - `MAIL_FROM_ADDRESS` (une adresse validée chez Brevo)
  - `MAIL_FROM_NAME="Abòrò Labs"`
- **Pour un test rapide** : dans *Administration → Paramètres*, décoche « Vérification de l’e-mail obligatoire pour les TP ».

## Mettre à jour le site

Chaque `git push` sur la branche principale redéploie automatiquement le site. Le contenu modifié dans l’administration n’est jamais écrasé par un redéploiement.

## En cas de problème

- **Logs** (onglet *Logs* de Render) : le message `APP_KEY est vide` signifie qu’il manque la clé de l’étape 3. Une erreur de connexion à la base vient presque toujours d’une `DB_URL` mal copiée.
- **Téléphone de double authentification perdu, sans code de secours** : l’offre gratuite de Render n’a pas de console. Dans l’éditeur SQL de Neon, exécute :
  `update users set two_factor_secret = null, two_factor_recovery_codes = null, two_factor_confirmed_at = null where email = 'ton@adresse';`
  Reconnecte-toi, puis réactive la double authentification.
