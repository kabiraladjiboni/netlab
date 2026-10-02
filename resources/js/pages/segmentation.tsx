import { Link } from '@inertiajs/react';
import { ArrowRight, Calculator, GraduationCap, Layers, Network, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAssistantContext } from '@/components/assistant/assistant-provider';
import { PageHeader, Section } from '@/components/content/page-header';
import { ScenarioPlayer } from '@/components/engine/scenario-player';
import { LabGate } from '@/components/learning/lab-gate';
import { useLabAccess } from '@/hooks/use-auth';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { addressKind, sameSubnet, subnetInfo } from '@/lib/cidr';
import { cn } from '@/lib/utils';
import { getScenarioVariants } from '@/scenarios';
import type { ProtocolSummary, Quiz } from '@/types/content';
import { ProtocolCard } from './protocols/index';

type NetworkType = { slug: string; acronym: string | null; name: string; definition: string; scope: string };

export default function Segmentation({ protocols, types, quiz }: { protocols: ProtocolSummary[]; types: NetworkType[]; quiz: Quiz | null }) {
    const access = useLabAccess();
    const vlan = getScenarioVariants('vlan')?.[0];
    const [ip, setIp] = useState('192.168.1.10');
    const [prefix, setPrefix] = useState(24);
    const [other, setOther] = useState('192.168.1.1');
    const info = useMemo(() => subnetInfo(ip, prefix), [ip, prefix]);
    const same = sameSubnet(ip, other, prefix);

    useAssistantContext({ page: 'segmentation', title: 'VLAN, sous-réseaux et segmentation', focus: info ? `${info.address}/${prefix}` : undefined });

    return (
        <>
            <PageHeader
                eyebrow="Architecture"
                title="VLAN, sous-réseaux et segmentation"
                description="Séparer un réseau peut se faire à plusieurs niveaux : en couche 2 avec les VLAN, en couche 3 avec les sous-réseaux, et avec des règles de sécurité. Ces trois mécanismes se complètent sans se confondre."
            />

            <Section>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[
                        { icon: Layers, title: 'Segmentation de couche 2', subtitle: 'VLAN (IEEE 802.1Q)', text: 'Isole des domaines de diffusion sur les mêmes commutateurs. Deux VLAN ne communiquent pas sans routage.', color: 'text-layer-link' },
                        { icon: Network, title: 'Sous-réseaux IP', subtitle: 'Couche 3 — CIDR, masque', text: 'Découpe l’espace d’adresses. Il détermine qui est « local » et qui doit passer par une passerelle.', color: 'text-layer-network' },
                        { icon: ShieldCheck, title: 'Contrôle de sécurité', subtitle: 'ACL, pare-feu', text: 'Autorise ou bloque explicitement les flux entre segments. Un VLAN seul n’est pas une politique de sécurité.', color: 'text-warn' },
                    ].map((card) => (
                        <div key={card.title} className="rounded-2xl border border-line bg-surface p-5">
                            <card.icon className={cn('size-6', card.color)} aria-hidden />
                            <h2 className="mt-3 font-display text-lg font-semibold">{card.title}</h2>
                            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                            <p className="mt-2 text-sm leading-relaxed text-foreground/85">{card.text}</p>
                        </div>
                    ))}
                </div>
            </Section>

            {vlan && (
                <Section title="Deux VLAN sur un même commutateur" description="Le PC A et le PC B partagent le même commutateur, mais pas le même VLAN : regarde comment le routeur les relie.">
                    <ScenarioPlayer scenario={vlan.scenario} contextTitle="VLAN et routage inter-VLAN" stepLimit={3} lockedSlot={<LabGate access={access} labHref="/laboratoire/vlan" compact />} />
                    <Link href="/lecons/vlan" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-signal hover:underline">
                        Ouvrir la leçon complète avec son quiz <ArrowRight className="size-4" aria-hidden />
                    </Link>
                </Section>
            )}

            <Section title={<span className="flex items-center gap-2"><Calculator className="size-6 text-signal" aria-hidden /> Calculateur de sous-réseau</span>} description="Saisis une adresse IPv4 et un préfixe : les bits « réseau » et les bits « hôte » apparaissent en couleur.">
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
                    <div className="space-y-4 rounded-3xl border border-line bg-surface p-5">
                        <label className="block text-sm">
                            <span className="font-medium">Adresse IPv4</span>
                            <input value={ip} onChange={(event) => setIp(event.target.value)} inputMode="decimal" className="mt-1.5 h-10 w-full rounded-xl border border-line bg-night-900 px-3 font-mono" aria-invalid={!info} />
                        </label>
                        <label className="block text-sm">
                            <span className="flex justify-between font-medium">
                                Préfixe <span className="font-mono text-signal">/{prefix}</span>
                            </span>
                            <input type="range" min={8} max={32} value={prefix} onChange={(event) => setPrefix(Number(event.target.value))} className="mt-2 w-full accent-[var(--color-signal)]" />
                        </label>
                        <label className="block text-sm">
                            <span className="font-medium">Comparer avec l’adresse</span>
                            <input value={other} onChange={(event) => setOther(event.target.value)} inputMode="decimal" className="mt-1.5 h-10 w-full rounded-xl border border-line bg-night-900 px-3 font-mono" />
                        </label>
                        {same !== null && (
                            <p className={cn('rounded-xl p-3 text-sm', same ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn')} role="status">
                                {same
                                    ? 'Même sous-réseau : les deux appareils peuvent communiquer directement (après résolution ARP).'
                                    : 'Sous-réseaux différents : le trafic doit passer par une passerelle (un routeur).'}
                            </p>
                        )}
                    </div>
                    <div className="rounded-3xl border border-line bg-surface p-5" aria-live="polite">
                        {!info ? (
                            <p className="text-sm text-danger">Adresse invalide : quatre nombres de 0 à 255 séparés par des points.</p>
                        ) : (
                            <>
                                <div className="overflow-x-auto pb-2 scrollbar-thin">
                                    <p className="font-mono text-sm tracking-wider whitespace-nowrap sm:text-base" aria-label={`Représentation binaire : ${prefix} bits réseau, ${32 - prefix} bits hôte`}>
                                        {info.binary.split('').map((bit, index) => (
                                            <span key={index} className={cn(index < prefix ? 'text-signal' : 'text-warn', index % 8 === 7 && index < 31 && 'mr-2')}>
                                                {bit}
                                            </span>
                                        ))}
                                    </p>
                                </div>
                                <p className="mt-1 text-xs">
                                    <span className="text-signal">■ {prefix} bits réseau</span> <span className="ml-3 text-warn">■ {32 - prefix} bits hôte</span>
                                </p>
                                <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                                    {[
                                        ['Masque', info.mask],
                                        ['Adresse du réseau', `${info.network}/${prefix}`],
                                        ['Diffusion', info.broadcast ?? '— (pas de diffusion en /31 et /32)'],
                                        ['Plage d’hôtes', `${info.firstHost} → ${info.lastHost}`],
                                        ['Adresses dans le bloc', info.total.toLocaleString('fr-FR')],
                                        ['Hôtes utilisables', info.usable.toLocaleString('fr-FR')],
                                        ['Type d’adresse', addressKind(ip) ?? '—'],
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <dt className="text-xs text-muted-foreground">{label}</dt>
                                            <dd className="font-mono">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <p className="mt-4 text-xs text-muted-foreground">En IPv4, la première adresse (réseau) et la dernière (diffusion) ne sont pas attribuées aux hôtes, sauf en /31 (liens point à point, RFC 3021) et /32.</p>
                            </>
                        )}
                    </div>
                </div>
            </Section>

            <Section title="LAN, WAN et réseaux d’opérateurs" description="Du réseau local jusqu’au cœur des opérateurs.">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {types.map((type) => (
                        <li key={type.slug}>
                            <Link href={`/reseaux?type=${type.slug}`} className="block h-full rounded-2xl border border-line bg-surface p-4 hover:border-signal/50">
                                <span className="font-display font-semibold">
                                    {type.acronym && <span className="mr-1.5 text-signal">{type.acronym}</span>}
                                    {type.name}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">{type.scope}</span>
                                <span className="mt-2 line-clamp-3 block text-sm text-foreground/85">{type.definition}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title="Technologies de segmentation et de transport" description="VLAN pour le réseau local, VXLAN et MPLS pour les centres de données et les opérateurs, VPN pour relier des sites à travers Internet.">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {protocols.map((protocol) => (
                        <li key={protocol.slug}>
                            <ProtocolCard protocol={protocol} />
                        </li>
                    ))}
                </ul>
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
