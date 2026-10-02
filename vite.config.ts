import inertia from '@inertiajs/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/app.tsx',
            refresh: true,
        }),
        // Serveur SSR limité à la machine locale (Laravel l'appelle sur 127.0.0.1:13714).
        inertia({ ssr: { entry: 'resources/js/app.tsx', host: '127.0.0.1' } }),
        react(),
        tailwindcss(),
    ],
    // Rendu serveur : tout est inclus dans bootstrap/ssr (aucun node_modules nécessaire
    // sur l'hébergeur, l'image Docker ne contient que Node).
    ssr: {
        noExternal: true,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
    },
    server: {
        watch: { ignored: ['**/vendor/**', '**/storage/**'] },
    },
});
