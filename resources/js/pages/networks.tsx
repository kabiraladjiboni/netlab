import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, GraduationCap, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAssistantContext } from '@/components/assistant/assistant-provider';
import { PageHeader, Section } from '@/components/content/page-header';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { DeviceIcon } from '@/components/scene/device-icon';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';
import type { Quiz } from '@/types/content';

type NetworkType = {
    slug: string;
    acronym: string | null;
    name: string;
    dimension: 'geographic' | 'usage' | 'virtual' | 'infrastructure';
    definition: string;
    objective: string;
    example: string;
    technologies: string[];
    scope: string;
    relations: string;
    illustration: string | null;
};

const SCALES = [
    { slug: 'pan', label: 'PAN', name: 'Réseau personnel', r: 46, kinds: ['phone', 'iot'] as const },
    { slug: 'lan', label: 'LAN / WLAN', name: 'Réseau local', r: 92, kinds: ['laptop', 'box'] as const },
    { slug: 'can', label: 'CAN', name: 'Campus', r: 142, kinds: ['switch'] as const },
    { slug: 'man', label: 'MAN', name: 'Ville', r: 196, kinds: ['router'] as const },
    { slug: 'wan', label: 'WAN', name: 'Pays / continent', r: 252, kinds: ['tower'] as const },
    { slug: 'internet', label: 'Internet', name: 'Le monde', r: 310, kinds: ['cloud'] as const },
];

const DIMENSIONS: { key: NetworkType['dimension']; label: string; description: string }[] = [
    { key: 'geographic', label: 'Selon la portée', description: 'Classement par étendue géographique.' },
    { key: 'usage', label: 'Selon l’usage', description: 'Classement selon ce que le réseau sert à faire.' },
    { key: 'virtual', label: 'Réseau virtuel', description: 'Un réseau logique construit au-dessus d’un autre.' },
    { key: 'infrastructure', label: 'Infrastructures d’opérateurs', description: 'Les grandes parties des réseaux qui forment Internet.' },
];

export default function Networks({ types, quiz, initialType }: { types: NetworkType[]; quiz: Quiz | null; initialType: string | null }) {
    const { reducedMotion } = usePreferences();
    const initialScale = Math.max(0, SCALES.findIndex((scale) => scale.slug === initialType || (initialType === 'wlan' && scale.slug === 'lan')));
    const [scale, setScale] = useState(initialScale);
    const [dimension, setDimension] = useState<NetworkType['dimension']>(() => types.find((t) => t.slug === initialType)?.dimension ?? 'geographic');
    const [selected, setSelected] = useState<string | null>(initialType);
    const current = SCALES[scale];
    const currentType = types.find((type) => type.slug === current.slug) ?? types.find((type) => type.slug === 'internet');
    const zoom = 300 / current.r;

    useAssistantContext({ page: 'types-reseaux', title: 'Types de réseaux', focus: currentType ? currentType.name : undefined, excerpt: currentType?.definition });

    useEffect(() => {
        if (initialType) document.getElementById(`type-${initialType}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [initialType]);

    return (
        <>
            <PageHeader
                eyebrow="Architecture"
                title="PAN, LAN, WLAN, CAN, MAN, WAN… et les autres"
                description="On classe les réseaux selon plusieurs dimensions : leur portée, leur usage, leur nature (virtuelle ou non) et leur place dans l’infrastructure. Ces catégories ne s’excluent pas : un même réseau peut être à la fois un WLAN, un réseau domestique et un réseau d’accès."
            />

            <Section title="Zoom : du réseau personnel à Internet" description="Avance ou recule pour changer d’échelle.">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
                    <div className="glass overflow-hidden rounded-3xl p-3">
                        <svg viewBox="-330 -330 660 660" className="mx-auto block aspect-square w-full max-w-[30rem]" role="img" aria-label={`Échelle affichée : ${current.label}, ${current.name}`}>
                            <motion.g animate={{ scale: zoom }} transition={{ duration: reducedMotion ? 0 : 0.9, ease: [0.4, 0, 0.2, 1] }}>
                                {[...SCALES].reverse().map((item, index) => {
                                    const realIndex = SCALES.length - 1 - index;
                                    const active = realIndex === scale;
                                    const inside = realIndex <= scale;
                                    return (
                                        <g key={item.slug}>
                                            <circle
                                                r={item.r}
                                                fill={active ? 'color-mix(in oklab, var(--color-signal) 8%, transparent)' : 'color-mix(in oklab, var(--color-electric) 3%, transparent)'}
                                                stroke={active ? 'var(--color-signal)' : 'var(--scene-link-dim)'}
                                                strokeWidth={(active ? 2.5 : 1.2) / zoom}
                                                strokeDasharray={`${6 / zoom} ${6 / zoom}`}
                                                opacity={inside ? 1 : 0.35}
                                            />
                                            <text
                                                y={-item.r + 16 / zoom}
                                                textAnchor="middle"
                                                fontSize={13 / zoom}
                                                fontWeight={600}
                                                fill={active ? 'var(--color-signal)' : 'var(--color-muted-foreground)'}
                                                opacity={inside ? 1 : 0.4}
                                            >
                                                {item.label}
                                            </text>
                                            {item.kinds.map((kind, k) => {
                                                const angle = (Math.PI / 4) * (k * 2 + 1) + realIndex * 0.6;
                                                const radius = realIndex === 0 ? 18 * k : item.r - (item.r - (SCALES[realIndex - 1]?.r ?? 0)) / 2;
                                                const x = realIndex === 0 ? (k === 0 ? -14 : 16) : Math.cos(angle) * radius;
                                                const y = realIndex === 0 ? 4 : Math.sin(angle) * radius;
                                                const size = Math.min(0.55, (item.r - (SCALES[realIndex - 1]?.r ?? 0)) / 90);
                                                return (
                                                    <g key={kind} transform={`translate(${x} ${y}) scale(${realIndex === 0 ? 0.32 : size})`} opacity={inside ? 1 : 0.3}>
                                                        <DeviceIcon kind={kind} />
                                                    </g>
                                                );
                                            })}
                                        </g>
                                    );
                                })}
                            </motion.g>
                        </svg>
                        <div className="mt-2 flex items-center justify-center gap-2">
                            <button type="button" onClick={() => setScale(Math.max(0, scale - 1))} disabled={scale === 0} className="rounded-full p-2 hover:bg-night-700 disabled:opacity-30" aria-label="Échelle plus petite">
                                <ChevronLeft className="size-5" aria-hidden />
                            </button>
                            <div role="radiogroup" aria-label="Échelle" className="flex flex-wrap justify-center gap-1">
                                {SCALES.map((item, index) => (
                                    <button
                                        key={item.slug}
                                        type="button"
                                        role="radio"
                                        aria-checked={index === scale}
                                        onClick={() => setScale(index)}
                                        className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition', index === scale ? 'bg-signal text-on-accent' : 'text-muted-foreground hover:text-foreground')}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                            <button type="button" onClick={() => setScale(Math.min(SCALES.length - 1, scale + 1))} disabled={scale === SCALES.length - 1} className="rounded-full p-2 hover:bg-night-700 disabled:opacity-30" aria-label="Échelle plus grande">
                                <ChevronRight className="size-5" aria-hidden />
                            </button>
                        </div>
                    </div>
                    {currentType && (
                        <motion.div key={currentType.slug} initial={reducedMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} aria-live="polite">
                            <p className="text-xs font-semibold tracking-[0.18em] text-signal uppercase">{current.label}</p>
                            <h3 className="mt-2 font-display text-3xl font-semibold">{currentType.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Portée : {currentType.scope}</p>
                            <p className="mt-4 text-lg leading-relaxed">{currentType.definition}</p>
                            <p className="mt-3 text-sm">
                                <strong>Exemple : </strong>
                                {currentType.example}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {currentType.technologies.map((technology) => (
                                    <span key={technology} className="rounded-full border border-line px-2.5 py-0.5 text-xs">
                                        {technology}
                                    </span>
                                ))}
                            </div>
                            <p className="mt-4 flex gap-2 rounded-2xl border border-line bg-night-900/50 p-3 text-sm text-muted-foreground">
                                <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden /> {currentType.relations}
                            </p>
                        </motion.div>
                    )}
                </div>
            </Section>

            <Section title="Toutes les catégories">
                <div role="tablist" aria-label="Dimensions" className="flex flex-wrap gap-2">
                    {DIMENSIONS.map((item) => (
                        <button
                            key={item.key}
                            role="tab"
                            aria-selected={dimension === item.key}
                            onClick={() => setDimension(item.key)}
                            className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', dimension === item.key ? 'border-signal bg-signal/15' : 'border-line text-muted-foreground hover:text-foreground')}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{DIMENSIONS.find((item) => item.key === dimension)?.description}</p>
                <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2" role="tabpanel">
                    {types
                        .filter((type) => type.dimension === dimension)
                        .map((type) => {
                            const open = selected === type.slug;
                            return (
                                <li key={type.slug} id={`type-${type.slug}`} className={cn('scroll-mt-24 rounded-2xl border bg-surface p-5 transition', open ? 'border-signal/60' : 'border-line')}>
                                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                        <h3 className="font-display text-lg font-semibold">
                                            {type.acronym && <span className="mr-2 text-signal">{type.acronym}</span>}
                                            {type.name}
                                        </h3>
                                        <span className="text-xs text-muted-foreground">{type.scope}</span>
                                    </div>
                                    <p className="mt-2 text-sm leading-relaxed">{type.definition}</p>
                                    <button type="button" onClick={() => setSelected(open ? null : type.slug)} aria-expanded={open} className="mt-3 text-sm font-medium text-signal hover:underline">
                                        {open ? 'Masquer les détails' : 'Objectif, exemple, technologies, relations'}
                                    </button>
                                    {open && (
                                        <dl className="mt-3 space-y-2.5 text-sm">
                                            <div>
                                                <dt className="font-semibold">Objectif</dt>
                                                <dd className="text-foreground/85">{type.objective}</dd>
                                            </div>
                                            <div>
                                                <dt className="font-semibold">Exemple</dt>
                                                <dd className="text-foreground/85">{type.example}</dd>
                                            </div>
                                            <div>
                                                <dt className="font-semibold">Technologies</dt>
                                                <dd className="text-foreground/85">{type.technologies.join(', ')}</dd>
                                            </div>
                                            <div>
                                                <dt className="font-semibold">Relations avec les autres catégories</dt>
                                                <dd className="text-foreground/85">{type.relations}</dd>
                                            </div>
                                        </dl>
                                    )}
                                </li>
                            );
                        })}
                </ul>
            </Section>

            <Section title="Comparaison rapide">
                <div className="overflow-x-auto rounded-2xl border border-line scrollbar-thin">
                    <table className="w-full min-w-[40rem] text-left text-sm">
                        <thead className="bg-night-850 text-xs tracking-wide text-muted-foreground uppercase">
                            <tr>
                                <th scope="col" className="px-4 py-2.5 font-medium">Réseau</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Portée</th>
                                <th scope="col" className="px-4 py-2.5 font-medium">Exemple</th>
                            </tr>
                        </thead>
                        <tbody>
                            {types
                                .filter((type) => type.acronym)
                                .map((type) => (
                                    <tr key={type.slug} className="border-t border-line/60">
                                        <th scope="row" className="px-4 py-3 font-medium">
                                            <span className="text-signal">{type.acronym}</span> — {type.name}
                                        </th>
                                        <td className="px-4 py-3 text-foreground/85">{type.scope}</td>
                                        <td className="px-4 py-3 text-foreground/85">{type.example}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            {quiz && (
                <Section title={<span className="flex items-center gap-2"><GraduationCap className="size-6 text-signal" aria-hidden /> Vérifier ses connaissances</span>}>
                    <div className="max-w-3xl">
                        <QuizRunner quiz={quiz} />
                    </div>
                </Section>
            )}
        </>
    );
}
