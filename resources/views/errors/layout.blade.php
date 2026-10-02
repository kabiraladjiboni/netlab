<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>@yield('title') · {{ config('netlab.name', 'Abòrò Labs') }}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <style>
        :root { color-scheme: dark light; --bg: #101d35; --fg: #f4f7fb; --muted: #9db0c8; --accent: #45d6c5; --line: #27364b; }
        @media (prefers-color-scheme: light) { :root { --bg: #f4f7fb; --fg: #101d35; --muted: #56667d; --accent: #0b7d71; --line: #dce4ef; } }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; padding: 24px; }
        main { max-width: 520px; text-align: center; }
        .code { font-family: ui-monospace, Menlo, monospace; color: var(--accent); font-size: 14px; letter-spacing: .2em; }
        h1 { font-size: clamp(28px, 6vw, 40px); margin: 12px 0; letter-spacing: -.02em; }
        p { color: var(--muted); line-height: 1.6; margin: 0 0 24px; }
        a.btn { display: inline-block; background: var(--accent); color: var(--bg); text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 12px; }
        .logo { width: 56px; height: 56px; margin: 0 auto 16px; display: block; }
        .links { margin-top: 20px; font-size: 14px; } .links a { color: var(--accent); margin: 0 8px; }
    </style>
</head>
<body>
<main>
    <img class="logo" src="/favicon.svg" alt="">
    <div class="code">ERREUR @yield('code')</div>
    <h1>@yield('title')</h1>
    <p>@yield('message')</p>
    <a class="btn" href="/">Retour à l’accueil</a>
    <div class="links"><a href="/apprendre">Cours</a><a href="/protocoles">Protocoles</a><a href="/dictionnaire">Dictionnaire</a></div>
</main>
</body>
</html>
