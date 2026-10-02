# Audit de sécurité — Abòrò Labs (référentiel OWASP)

Version 2.3 · octobre 2026

Référentiels utilisés :

- **OWASP Top 10 (2021)** ;
- **OWASP ASVS 4.0** (niveau 2 visé pour les comptes et l’administration) ;
- **OWASP Secure Headers Project** ;
- fiche OWASP sur l’injection CSV.

Cet audit porte sur le code de l’application. L’hébergement (serveur, TLS, pare-feu, sauvegardes) reste à sécuriser au moment du déploiement (voir §4).

## 1. Synthèse par catégorie OWASP Top 10

| Catégorie | Ce qui était déjà en place | Ajouté dans la version 2.3 |
| --- | --- | --- |
| **A01 Contrôle d’accès** | Rôle non assignable par formulaire ; middleware `admin` côté serveur ; un étudiant n’accède qu’à ses données ; corrections de diagnostics révélées seulement par l’API | **Double authentification obligatoire pour l’administration** ; en-tête `Cache-Control: no-store` sur les pages personnelles ; `noindex` sur les espaces privés |
| **A02 Défaillances cryptographiques** | Mots de passe hachés (bcrypt, coût 12) ; aucune clé d’API dans le frontend ; aucune IP complète conservée | Session **chiffrée** (`SESSION_ENCRYPT=true`) ; cookie `Secure` et préfixe **`__Host-`** en production HTTPS ; **HSTS** ; secret 2FA **chiffré** en base ; codes de secours stockés sous forme d’**empreintes SHA-256** ; liens forcés en HTTPS |
| **A03 Injection / XSS** | Requêtes paramétrées (Eloquent) ; React échappe tout le texte ; mini-syntaxe de contenu sans HTML ; scénarios personnalisés validés, aucun code exécuté | **Content-Security-Policy stricte avec nonce** (aucun script tiers ou injecté ne s’exécute) ; JSON-LD échappé (`JSON_HEX_TAG`) ; adresse du logo limitée à `/…` ou `http(s)://` (pas de `javascript:`) ; **exports CSV protégés contre l’injection de formules** |
| **A04 Conception non sûre** | Limitation de débit (connexion, inscription, assistant, API) ; notes recalculées côté serveur | Limite de 5 essais de code 2FA (verrou de 5 min) ; un code TOTP ne peut **pas être rejoué** |
| **A05 Mauvaise configuration** | `APP_DEBUG=false` documenté pour la production | En-têtes OWASP : `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `COOP`, `CORP`, `Permissions-Policy`, `nosniff`, `X-Permitted-Cross-Domain-Policies` ; `X-Powered-By` supprimé ; **TrustHosts** en production ; serveur SSR lié à 127.0.0.1 ; pages d’erreur sans détail technique ; commande **`php artisan netlab:security-check`** |
| **A06 Composants vulnérables** | — | `npm audit` : **0 vulnérabilité** (production). `composer audit` n’a pas pu être lancé depuis mon environnement (dépôt Packagist inaccessible) : **à lancer sur ta machine**. |
| **A07 Authentification** | Message d’erreur générique ; verrouillage par e-mail et IP ; réinitialisation sans énumération ; session régénérée à la connexion ; autres appareils déconnectés au changement de mot de passe | **Politique ASVS 2.1** : 12 à 128 caractères, sans règles de composition imposées, refus des mots de passe divulgués (Have I Been Pwned, k-anonymat) en production ; **indicateur de robustesse** ; **double authentification TOTP** (QR code généré localement, 8 codes de secours) ; durée de réponse identique que le compte existe ou non |
| **A08 Intégrité** | Pas de désérialisation d’entrées utilisateur ; scénarios en JSON validés | Logo téléversé **ré-encodé en PNG** (métadonnées et contenu caché supprimés), dimensions limitées, nom aléatoire |
| **A09 Journalisation** | Journal d’administration sans secret | **Journal de sécurité** (`storage/logs/security-*.log`, 90 jours) : connexions, échecs, verrouillages, 2FA, mots de passe, rôles, suspensions, exports. Il ne contient **ni mot de passe, ni code, ni IP en clair, ni e-mail en clair** (empreintes HMAC) ; un test le vérifie. |
| **A10 SSRF** | Appels sortants limités aux API d’IA configurées dans `.env` | — (aucune URL saisie par un utilisateur n’est appelée par le serveur) |

Autres ajouts :

- `/.well-known/security.txt` (RFC 9116), publié dès qu’une adresse de contact est renseignée dans les paramètres ;
- `php artisan netlab:2fa-reset email`, une procédure de secours journalisée en cas de téléphone perdu.

## 2. Content-Security-Policy appliquée

```
default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none';
upgrade-insecure-requests (production HTTPS)
```

- Il n’y a ni `unsafe-eval`, ni `unsafe-inline` pour les scripts : chaque script porte un nonce aléatoire différent à chaque requête.
- `unsafe-inline` reste autorisé pour les **styles** uniquement. Les animations et le rendu serveur utilisent des attributs `style`. Le risque est faible, car un style ne peut pas exécuter de code.
- En développement (`npm run dev`), l’adresse du serveur Vite est ajoutée automatiquement.
- Un mode d’observation sans blocage est disponible : `NETLAB_CSP=report`.
- La politique a été contrôlée dans le navigateur, sans aucune violation, sur :
  - les pages publiques ;
  - l’espace étudiant ;
  - 7 pages d’administration ;
  - l’activation de la 2FA.

## 3. Risques résiduels assumés

1. **Inscription** : un message indique si une adresse est déjà utilisée. C’est un compromis courant pour l’ergonomie. Il est limité à 10 inscriptions par heure et par IP.
2. **Vérification des mots de passe divulgués** : en production, les 5 premiers caractères de l’empreinte SHA-1 du mot de passe sont envoyés à `api.pwnedpasswords.com`. Le mot de passe lui-même ne quitte jamais le serveur. On peut désactiver cette vérification avec `NETLAB_BREACHED_PASSWORDS=false`.
3. **Préchargement HSTS** (`preload`) non activé : c’est un engagement difficile à annuler, à décider une fois le domaine définitif choisi.
4. Les styles en ligne restent autorisés (voir §2).

## 4. Avant la mise en ligne

Lance `php artisan netlab:security-check` : tous les points doivent être verts en production. Ensuite :

- **HTTPS** obligatoire (Let’s Encrypt) et redirection du HTTP vers le HTTPS au niveau du serveur ;
- le **dossier `public/` seul** exposé par le serveur web (`.env`, `storage/` et `vendor/` jamais accessibles) ;
- **sauvegardes** régulières et chiffrées de la base de données, avec un test de restauration ;
- **mises à jour** : `composer audit` et `npm audit` chaque mois, puis `composer update` et `npm update` ;
- **comptes administrateurs** : 2FA active (obligatoire) et codes de secours rangés hors ligne ;
- un **test d’intrusion** par un tiers indépendant, recommandé avant une ouverture à grande échelle.

## 5. Tests automatiques

`tests/Feature/SecurityTest.php` contient 16 tests :

- en-têtes et nonce CSP ;
- `no-store` sur les pages personnelles ;
- politique de mot de passe ;
- vecteurs officiels de la RFC 6238 ;
- refus du rejeu d’un code ;
- activation de la 2FA ;
- connexion en deux étapes ;
- verrouillage après 5 essais ;
- codes de secours à usage unique ;
- 2FA obligatoire pour l’administration ;
- désactivation de la 2FA ;
- journal sans données sensibles ;
- schémas d’URL dangereux refusés ;
- exports CSV ;
- impossibilité pour un étudiant de deviner les identifiants de comptes (réponse 403 identique, que le compte existe ou non) ;
- création du premier administrateur par variables d’environnement, sans jamais modifier un compte existant ;
- `security.txt`.
