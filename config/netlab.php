<?php

/*
|--------------------------------------------------------------------------
| Abòrò Labs (nom de travail, à valider juridiquement avant dépôt)
|--------------------------------------------------------------------------
| Le nom du produit est provisoire : il se modifie ici (ou via APP_NAME).
*/

return [
    'name' => env('NETLAB_NAME', env('APP_NAME', 'Abòrò Labs')),

    /*
    | Sécurité (fixée par l'environnement, jamais depuis l'interface d'administration).
    */
    'security' => [
        // Content-Security-Policy : enforce (bloque), report (signale seulement) ou off.
        'csp' => env('NETLAB_CSP', 'enforce'),
        // Double authentification obligatoire pour accéder à l'administration.
        'admin_two_factor' => (bool) env('NETLAB_ADMIN_2FA', true),
        // Vérifie les nouveaux mots de passe auprès de Have I Been Pwned (k-anonymat :
        // seuls les 5 premiers caractères de l'empreinte SHA-1 quittent le serveur).
        // Adresses des proxys de l'hébergeur (« * » derrière Render, Koyeb…).
        'trusted_proxies' => env('TRUSTED_PROXIES'),
        'breached_passwords' => (bool) env('NETLAB_BREACHED_PASSWORDS', env('APP_ENV') === 'production'),
    ],

    // Signature de la marque et signature communautaire.
    'slogan' => 'Les réseaux prennent vie.',
    'community' => 'Abòrò',
    'community_motto' => 'Abòrò, on explore ensemble !',

    'tagline' => 'Explore. Comprends. Expérimente. La technologie se comprend mieux quand on l’explore ensemble : suis les paquets, observe les protocoles et manipule des laboratoires interactifs.',

    'ai' => [
        // none | anthropic | openai
        'provider' => env('NETLAB_AI_PROVIDER', 'none'),
        'api_key' => env('NETLAB_AI_API_KEY'),
        'model' => env('NETLAB_AI_MODEL'),
        'timeout' => (int) env('NETLAB_AI_TIMEOUT', 20),
        'max_question_length' => 600,
        'endpoints' => [
            'anthropic' => 'https://api.anthropic.com/v1/messages',
            'openai' => 'https://api.openai.com/v1/chat/completions',
        ],
        'default_models' => [
            'anthropic' => 'claude-sonnet-4-5',
            'openai' => 'gpt-4.1-mini',
        ],
    ],

    'content_path' => database_path('content'),

    /*
    | Estimation du pays (approximative). Aucune adresse IP n'est stockée.
    | NETLAB_GEO_HEADER : nom d'un en-tête posé par un proxy DE CONFIANCE
    | (ex. CF-IPCountry derrière Cloudflare). Sinon : base locale importée
    | avec `php artisan netlab:geoip-import fichier.csv`.
    */
    'geo' => [
        'header' => env('NETLAB_GEO_HEADER'),
    ],

    /*
    | Scénarios intégrés au code (resources/js/scenarios). Leur publication
    | se gère depuis l'administration.
    */
    'builtin_scenarios' => [
        'acces-internet' => 'Accès à Internet depuis chez soi',
        'nat-pat' => 'NAT / PAT dans la box',
        'dns' => 'Résolution DNS',
        'tcp-handshake' => 'Poignée de main TCP',
        'arp' => 'ARP sur le réseau local',
        'dhcp' => 'DHCP : obtenir une adresse',
        'tls' => 'TLS 1.3 : chiffrer et prouver son identité',
        'vlan' => 'VLAN et routage inter-VLAN',
        'traceroute' => 'Traceroute et TTL',
    ],
];
