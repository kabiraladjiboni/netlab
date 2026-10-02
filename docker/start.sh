#!/bin/sh
# Démarrage du conteneur : configuration, base de données, puis serveurs.
set -e
cd /var/www/html

if [ -z "$APP_KEY" ]; then
    echo "ERREUR : la variable APP_KEY est vide. Génère-la avec « php artisan key:generate --show » et ajoute-la dans l'hébergeur." >&2
    exit 1
fi

# Apache écoute sur le port fourni par l'hébergeur (Render : $PORT).
sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link >/dev/null 2>&1 || true

# Tables, puis contenu pédagogique au premier démarrage seulement (jamais écrasé ensuite).
php artisan migrate --force
php artisan netlab:content >/dev/null 2>&1 && echo "Contenu pédagogique importé." || echo "Contenu déjà présent : conservé."

# Premier administrateur, créé seulement s'il n'en existe aucun (voir docs/DEPLOIEMENT-GRATUIT.md).
php artisan netlab:bootstrap-admin || true

chown -R www-data:www-data storage bootstrap/cache

# Rendu serveur (SEO) et tâches planifiées en arrière-plan ; le site fonctionne même si le SSR s'arrête.
php artisan inertia:start-ssr &
php artisan schedule:work >/dev/null 2>&1 &

exec apache2-foreground
