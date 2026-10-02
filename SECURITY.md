# Politique de sécurité — Abòrò Labs

## Signaler une faille

Écris à l’adresse de contact indiquée dans `/.well-known/security.txt` (ou sur la plateforme), avec :

- la page ou l’URL concernée ;
- les étapes pour reproduire ;
- l’impact que tu observes.

Merci de ne pas exploiter la faille au-delà de ce qui est nécessaire pour la démontrer, de ne pas accéder aux données d’autres personnes et de nous laisser le temps de corriger avant toute publication.

## Mesures en place

Le détail est dans [docs/AUDIT-SECURITE.md](docs/AUDIT-SECURITE.md) : il couvre l’OWASP Top 10 et l’ASVS (CSP avec nonce, double authentification, journal de sécurité, etc.).

Contrôle avant mise en ligne : `php artisan netlab:security-check`.
