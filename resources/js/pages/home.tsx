import { Link } from '@inertiajs/react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BookOpen, Compass, GraduationCap, Layers, Network, Radar, Sparkles, Stethoscope, Waypoints } from 'lucide-react';
import { useState } from 'react';
import { renderInline } from '@/components/content/rich-text';
import { LessonCard } from '@/components/content/lesson-card';
import { HeroAnimation } from '@/components/home/hero-animation';
import { LEVELS } from '@/hooks/use-preferences';
import type { Level } from '@/hooks/use-preferences';
import { useAuth, useShared } from '@/hooks/use-auth';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';
import type { LessonSummary } from '@/types/content';

type Props = {
    featured: LessonSummary[];
    stats: { protocols: number; complete: number; terms: number; lessons: number; labs: number; quizzes: number; diagnostics: number };
    categories: { slug: string; name: string; description: string; count: number }[];
};

const quickLinks = [
    { href: '/lecons/acces-internet', label: 'Explorer le fonctionnement d’Internet', text: 'Suis une requête Web de bout en bout.', icon: Compass },
    { href: '/protocoles', label: 'Découvrir les protocoles', text: 'Un catalogue relié aux couches et aux leçons.', icon: Waypoints },
    { href: '/modeles/osi', label: 'Apprendre le modèle OSI', text: 'Les 7 couches et l’encapsulation animée.', icon: Layers },
    { href: '/modeles/tcp-ip', label: 'Comprendre TCP/IP', text: 'Le modèle d’Internet, comparé à OSI.', icon: Layers },
    { href: '/reseaux', label: 'Découvrir les types de réseaux', text: 'Du PAN au WAN, et au-delà.', icon: Network },
    { href: '/wireshark', label: 'Apprendre Wireshark', text: 'Lire une capture sans se perdre.', icon: Radar },
    { href: '/dictionnaire', label: 'Explorer le vocabulaire', text: 'Des définitions simples et techniques.', icon: BookOpen },
    { href: '/quiz', label: 'Tester ses connaissances', text: 'Quiz et exercices de diagnostic.', icon: GraduationCap },
];

const levelDemo: Record<Level, string> = {
    1: "Ta box remplace l'adresse de ton ordinateur par la sienne avant d'envoyer le message sur Internet, et note dans un carnet à qui appartient la conversation.",
    2: "Traduction NAT/PAT : `192.168.1.10:51514` devient `203.0.113.25:62001`. La table de traduction permet de remettre la réponse au bon appareil.",
    3: "La box réécrit l'IP et le port source, décrémente le TTL et recalcule les sommes de contrôle IP et TCP (le pseudo-en-tête inclut les adresses). La destination n'est pas modifiée (RFC 3022, RFC 4787).",
};

export default function Home({ featured, stats, categories }: Props) {
    const { level, setLevel, reducedMotion } = usePreferences();
    const user = useAuth();
    const { app } = useShared();
    const [demo, setDemo] = useState<Level>(level);

    return (
        <>

            <section className="relative overflow-hidden">
                <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
                <div className="relative mx-auto grid grid-cols-1 max-w-7xl items-center gap-10 px-4 pt-10 pb-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-20">
                    <motion.div initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <p className="inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/10 px-3 py-1 text-xs font-medium text-signal">
                            <Sparkles className="size-3.5" aria-hidden /> {app.slogan} · Explore, comprends, expérimente
                        </p>
                        <h1 className="mt-5 font-display text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">
                            Comprends comment fonctionne <span className="text-gradient">Internet</span>.
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                            Explore les protocoles, suis les paquets et découvre les coulisses des réseaux grâce à des animations interactives.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link
                                href="/lecons/acces-internet"
                                className="inline-flex items-center gap-2 rounded-xl bg-signal px-5 py-3 font-semibold text-on-accent shadow-lg shadow-signal/20 transition hover:brightness-110"
                            >
                                Explorer une communication <ArrowRight className="size-4" aria-hidden />
                            </Link>
                            <Link href="/wireshark" className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 font-semibold transition hover:border-signal/60">
                                <Radar className="size-4 text-signal" aria-hidden /> Apprendre à lire Wireshark
                            </Link>
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">
                            {user ? (
                                <>
                                    Bon retour, {user.name} —{' '}
                                    <Link href="/app" className="font-medium text-signal hover:underline">
                                        reprendre là où tu t’es arrêté
                                    </Link>
                                </>
                            ) : (
                                <>
                                    100 % gratuit. Les cours sont ouverts à tous ;{' '}
                                    <Link href="/inscription" className="font-medium text-signal hover:underline">
                                        un compte gratuit
                                    </Link>{' '}
                                    permet de manipuler les TP et de sauvegarder ta progression.
                                </>
                            )}
                        </p>
                        <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
                            {[
                                { value: stats.protocols, label: 'fiches protocoles' },
                                { value: stats.terms, label: 'termes expliqués' },
                                { value: stats.labs, label: 'TP interactifs gratuits' },
                            ].map((item) => (
                                <div key={item.label}>
                                    <dt className="sr-only">{item.label}</dt>
                                    <dd>
                                        <span className="block font-display text-3xl font-semibold text-foreground">{item.value}</span>
                                        <span className="text-xs text-muted-foreground">{item.label}</span>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </motion.div>
                    <motion.div
                        initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                        className="glass rounded-[2rem] p-3 sm:p-5"
                    >
                        <HeroAnimation />
                        <p className="px-2 pb-1 text-center text-xs text-muted-foreground">
                            Un paquet quitte l’ordinateur, traverse la box et Internet, puis la réponse revient.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-labelledby="acces-rapides">
                <h2 id="acces-rapides" className="sr-only">
                    Accès rapides
                </h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {quickLinks.map((item) => (
                        <li key={item.href + item.label}>
                            <Link
                                href={item.href}
                                className="group flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:border-signal/50 hover:bg-surface-2"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-signal/10 text-signal transition group-hover:bg-signal group-hover:text-on-accent">
                                    <item.icon className="size-5" aria-hidden />
                                </span>
                                <span>
                                    <span className="block font-medium leading-snug">{item.label}</span>
                                    <span className="mt-1 block text-sm text-muted-foreground">{item.text}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-labelledby="methode">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-signal uppercase">La méthode</p>
                        <h2 id="methode" className="mt-3 font-display text-3xl font-semibold">Montrer d’abord, expliquer simplement, approfondir ensuite.</h2>
                        <p className="mt-4 text-muted-foreground">
                            Chaque leçon existe en trois niveaux. Tu peux changer de niveau à tout moment : rien n’est bloqué, et chaque terme technique s’explique d’un clic.
                        </p>
                        <ol className="mt-6 space-y-3">
                            {LEVELS.map((item) => (
                                <li key={item.value} className="flex items-start gap-3">
                                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-signal/15 font-mono text-sm font-semibold text-signal">{item.value}</span>
                                    <span>
                                        <span className="font-semibold">{item.label}</span>
                                        <span className="block text-sm text-muted-foreground">{item.description}</span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div className="glass rounded-3xl p-5 sm:p-7">
                        <p className="text-sm text-muted-foreground">Exemple : la même étape (« la box traduit l’adresse ») aux trois niveaux.</p>
                        <div role="tablist" aria-label="Niveau de l'exemple" className="mt-4 flex flex-wrap gap-2">
                            {LEVELS.map((item) => (
                                <button
                                    key={item.value}
                                    role="tab"
                                    aria-selected={demo === item.value}
                                    onClick={() => setDemo(item.value)}
                                    className={cn(
                                        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                                        demo === item.value ? 'border-signal bg-signal text-on-accent' : 'border-line hover:border-signal/50',
                                    )}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={demo}
                                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.25 }}
                                className="prose-net mt-5 min-h-28 text-base"
                                role="tabpanel"
                            >
                                {renderInline(levelDemo[demo])}
                            </motion.p>
                        </AnimatePresence>
                        <button
                            type="button"
                            onClick={() => setLevel(demo)}
                            className="mt-4 text-sm font-medium text-signal hover:underline"
                            disabled={level === demo}
                        >
                            {level === demo ? 'C’est ton niveau actuel' : `Choisir « ${LEVELS[demo - 1].label} » pour toute la plateforme`}
                        </button>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-labelledby="parcours">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-signal uppercase">Parcours</p>
                        <h2 id="parcours" className="mt-3 font-display text-3xl font-semibold">Par où commencer ?</h2>
                    </div>
                    <Link href="/apprendre" className="inline-flex items-center gap-1.5 text-sm font-medium text-signal hover:underline">
                        Tous les parcours <ArrowRight className="size-4" aria-hidden />
                    </Link>
                </div>
                <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {featured.map((lesson) => (
                        <li key={lesson.slug}>
                            <LessonCard lesson={lesson} />
                        </li>
                    ))}
                </ul>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-labelledby="familles">
                <p className="text-xs font-semibold tracking-[0.18em] text-signal uppercase">Catalogue</p>
                <h2 id="familles" className="mt-3 font-display text-3xl font-semibold">{stats.protocols} protocoles, mécanismes et outils, reliés entre eux</h2>
                <p className="mt-3 max-w-3xl text-muted-foreground">
                    {stats.complete} fiches complètes (champs, échanges, capture, erreurs courantes) et des fiches essentielles en cours d’enrichissement. Chaque fiche renvoie vers ses couches, ses protocoles associés et les leçons correspondantes.
                </p>
                <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {categories.map((category) => (
                        <li key={category.slug}>
                            <Link href={`/protocoles#${category.slug}`} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition hover:border-signal/50">
                                <span className="flex items-center justify-between gap-2">
                                    <span className="font-medium">{category.name}</span>
                                    <span className="rounded-full bg-night-700 px-2 py-0.5 font-mono text-xs text-muted-foreground">{category.count}</span>
                                </span>
                                <span className="mt-2 text-sm text-muted-foreground">{category.description}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
                <div className="glass flex flex-col items-start gap-5 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-warn/15 text-warn">
                        <Stethoscope className="size-6" aria-hidden />
                    </span>
                    <div className="flex-1">
                        <h2 className="font-display text-xl font-semibold">Mets-toi en situation de dépannage</h2>
                        <p className="mt-1 text-muted-foreground">
                            {stats.diagnostics} exercices de diagnostic : observe les symptômes, demande des indices, examine les échanges et trouve la cause.
                        </p>
                    </div>
                    <Link href="/diagnostic" className="inline-flex items-center gap-2 rounded-xl border border-warn/40 px-4 py-2.5 font-semibold text-warn transition hover:bg-warn/10">
                        Commencer un diagnostic <ArrowRight className="size-4" aria-hidden />
                    </Link>
                </div>
            </section>
        </>
    );
}
