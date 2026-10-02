<!DOCTYPE html>
<html lang="fr" class="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#101d35" media="(prefers-color-scheme: dark)">
        <meta name="theme-color" content="#f4f7fb" media="(prefers-color-scheme: light)">
        @php($brandName = app(\App\Services\Platform\Settings::class)->platformName())
        <meta name="application-name" content="{{ $brandName }}">
        <style>html{background-color:#101d35;}html.light{background-color:#f4f7fb;}</style>
        <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
            (function () {
                try {
                    var t = localStorage.getItem('netlab.theme') || 'system';
                    var dark = t === 'dark' || (t !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
                    var root = document.documentElement;
                    root.classList.toggle('dark', dark);
                    root.classList.toggle('light', !dark);
                    if (localStorage.getItem('netlab.reduceMotion') === 'true') {
                        document.documentElement.dataset.reduceMotion = 'true';
                    }
                } catch (e) {}
            })();
        </script>
        <link rel="icon" href="/favicon.ico" sizes="48x48">
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/site.webmanifest">
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        {{-- Sans serveur SSR, les balises de référencement sont posées ici (mêmes clés data-inertia). --}}
        <x-inertia::head>
            @php($headTags = $page['props']['head'] ?? [])
            @unless (collect($headTags)->contains(fn ($tag) => str_starts_with($tag, '<title')))
                <title data-inertia="">{{ $brandName }}</title>
            @endunless
            @foreach ($headTags as $tag)
                {!! $tag !!}
            @endforeach
        </x-inertia::head>
    </head>
    <body>
        <x-inertia::app />
    </body>
</html>
