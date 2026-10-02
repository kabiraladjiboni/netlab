# Abòrò Labs — image de production (Render, Koyeb, Fly.io, VPS…)
# Construction : docker build -t aboro-labs .
# Lancement    : docker run -p 8080:8080 --env-file .env.production aboro-labs

# 1. Interface (Vite) : site + rendu serveur (SSR)
FROM node:22-bookworm-slim AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vite.config.ts tsconfig.json ./
COPY resources ./resources
COPY public ./public
RUN npm run build

# 2. Dépendances PHP (sans les outils de développement)
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --no-autoloader --prefer-dist --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-scripts

# 3. Image finale : Apache + PHP 8.4, Node (pour le serveur SSR)
FROM php:8.4-apache
COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_pgsql pdo_sqlite intl gd zip bcmath opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*
COPY --from=assets /usr/local/bin/node /usr/local/bin/node

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    LOG_SECURITY_CHANNEL=stderr \
    PORT=8080

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-aboro.ini
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html
COPY --from=vendor /app /var/www/html
COPY --from=assets /app/public/build /var/www/html/public/build
COPY --from=assets /app/bootstrap/ssr /var/www/html/bootstrap/ssr

RUN rm -f public/hot .env \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x docker/start.sh

EXPOSE 8080
CMD ["sh", "docker/start.sh"]
