import { Link } from '@inertiajs/react';
import { ArrowRight, Eye, FlaskConical, Lightbulb, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { RichText } from '@/components/content/rich-text';
import { BrandName, Logo } from '@/components/layout/logo';
import { useShared } from '@/hooks/use-auth';

const TRAITS = [
    { icon: Lightbulb, title: 'Pédagogue', text: 'Une explication simple avant les détails techniques.' },
    { icon: Search, title: 'Curieux', text: 'Encourager l’exploration et les questions.' },
    { icon: Users, title: 'Complice', text: 'Un ton amical, notamment dans les défis et les messages.' },
    { icon: ShieldCheck, title: 'Rigoureux', text: 'Des protocoles et des explications techniquement vérifiés.' },
    { icon: Sparkles, title: 'Ambitieux', text: 'Un produit adapté aux débutants comme aux professionnels.' },
];

/** Page « Notre histoire » : socle de la marque et communauté Abòrò. */
export default function Story({ story, aboroMeaning, stats }: { story: string | null; aboroMeaning: string | null; stats: { labs: number; protocols: number; diagnostics: number } }) {
    const { app } = useShared();
    return (
        <>
            <section className="relative overflow-hidden border-b border-line/60">
                <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
                <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
                    <Logo className="mx-auto size-16" />
                    <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-gold uppercase">Explore · Comprends · Expérimente</p>
                    <h1 className="mt-3 text-4xl sm:text-5xl">
                        <BrandName name={app.name} />
                    </h1>
                    <p className="mt-3 font-display text-2xl text-gradient sm:text-3xl">{app.slogan}</p>
                    <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                        « Avec {app.name}, tu ne te contentes pas de lire comment fonctionne un réseau : tu le vois fonctionner. »
                    </p>
                </div>
            </section>

            <section className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-10 sm:px-6 md:grid-cols-3">
                {[
                    { title: 'Mission', text: 'Rendre les réseaux informatiques accessibles grâce à des visualisations interactives, des explications progressives et des travaux pratiques virtuels.' },
                    { title: 'Vision', text: 'Devenir une référence de l’apprentissage visuel des réseaux, née au Bénin et accessible aux apprenants partout dans le monde.' },
                    { title: 'Promesse', text: 'Comprendre les réseaux en les visualisant et en les manipulant : suivre les paquets, observer les protocoles, expérimenter dans un laboratoire.' },
                ].map((item) => (
                    <div key={item.title} className="rounded-3xl border border-line bg-surface p-6">
                        <h2 className="font-display text-lg font-semibold text-signal">{item.title}</h2>
                        <p className="mt-2 leading-relaxed">{item.text}</p>
                    </div>
                ))}
            </section>

            {story && (
                <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                    <h2 className="font-display text-2xl font-semibold">Notre histoire</h2>
                    <div className="mt-3">
                        <RichText text={story} />
                    </div>
                </section>
            )}

            <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
                <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 to-signal/8 p-6 sm:p-10">
                    <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{app.community_motto}</p>
                    <h2 className="mt-2 font-display text-3xl font-semibold">Pourquoi « Abòrò » ?</h2>
                    <p className="mt-3 text-lg">On apprend ensemble. On expérimente ensemble. On comprend ensemble.</p>
                    {aboroMeaning && (
                        <div className="mt-4 max-w-3xl text-muted-foreground">
                            <RichText text={aboroMeaning} />
                        </div>
                    )}
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
                <h2 className="font-display text-2xl font-semibold">Notre façon d’enseigner</h2>
                <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {TRAITS.map((trait) => (
                        <li key={trait.title} className="rounded-2xl border border-line bg-surface p-4">
                            <trait.icon className="size-5 text-signal" aria-hidden />
                            <p className="mt-2 font-semibold">{trait.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{trait.text}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                        { icon: Eye, title: 'Explorer', text: `Suivre une connexion Internet, visualiser DNS, DHCP, ARP, TCP/IP et le routage.`, href: '/apprendre' },
                        { icon: FlaskConical, title: 'Laboratoires', text: `${stats.labs} TP animés et ${stats.diagnostics} défis de diagnostic pour observer et dépanner.`, href: '/laboratoire' },
                        { icon: Sparkles, title: 'Progresser', text: `Parcours, quiz, ${stats.protocols} fiches protocoles et une progression sauvegardée.`, href: '/inscription' },
                    ].map((item) => (
                        <Link key={item.title} href={item.href} className="group rounded-3xl border border-line bg-surface p-6 transition hover:border-signal/50">
                            <item.icon className="size-6 text-signal" aria-hidden />
                            <p className="mt-3 font-display text-lg font-semibold group-hover:text-signal">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                            <ArrowRight className="mt-3 size-4 text-signal transition group-hover:translate-x-1" aria-hidden />
                        </Link>
                    ))}
                </div>
            </section>
        </>
    );
}
