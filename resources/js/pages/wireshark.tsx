import { Eye, EyeOff, FileSearch, Filter, GraduationCap, Info, Lock, Scale, Stethoscope, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAssistantContext } from '@/components/assistant/assistant-provider';
import { PageHeader, Section } from '@/components/content/page-header';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import { Badge } from '@/components/ui/badge';
import { rowColor, legend } from '@/components/wireshark/colors';
import { FilterBar } from '@/components/wireshark/filter-bar';
import { Missions } from '@/components/wireshark/missions';
import { PacketDetails } from '@/components/wireshark/packet-details';
import { PacketTable } from '@/components/wireshark/packet-table';
import { PcapImport } from '@/components/wireshark/pcap-import';
import { usePreferences } from '@/hooks/use-preferences';
import { cn } from '@/lib/utils';
import type { Quiz } from '@/types/content';
import { captures } from '@/wireshark/captures';
import { compileFilter } from '@/wireshark/filter';
import type { Capture } from '@/wireshark/types';

type Mode = 'beginner' | 'advanced';

const columns = [
    { name: 'No.', text: 'Numéro d’ordre du paquet dans la capture.' },
    { name: 'Time', text: 'Secondes écoulées depuis le premier paquet capturé.' },
    { name: 'Source / Destination', text: 'Adresses IP (ou MAC pour ARP) de l’émetteur et du destinataire.' },
    { name: 'Protocol', text: 'Le protocole de plus haut niveau reconnu par Wireshark dans le paquet.' },
    { name: 'Length', text: 'Taille de la trame capturée, en octets.' },
    { name: 'Info', text: 'Résumé lisible : ports, drapeaux TCP, requête DNS, méthode HTTP…' },
];

const captureFilters = [
    { bpf: 'host 192.168.1.10', text: 'uniquement le trafic de/vers cette machine' },
    { bpf: 'port 53', text: 'uniquement DNS (UDP ou TCP)' },
    { bpf: 'tcp port 443', text: 'uniquement HTTPS sur TCP' },
    { bpf: 'not arp', text: 'tout sauf ARP' },
];

const signals = [
    { title: 'SYN sans réponse, répété', text: 'Le client retransmet son SYN : le serveur ne répond pas, ou un pare-feu bloque silencieusement.', filter: 'tcp.flags.syn == 1 && tcp.flags.ack == 0' },
    { title: 'RST juste après un SYN', text: 'La machine répond mais aucun service n’écoute sur ce port (connexion refusée).', filter: 'tcp.flags.reset == 1' },
    { title: 'Retransmissions', text: 'Des segments sont renvoyés : pertes, congestion ou lien de mauvaise qualité.', filter: 'tcp.analysis.retransmission' },
    { title: 'Réponse DNS en erreur', text: 'rcode différent de 0 : NXDOMAIN (3) signifie que le nom n’existe pas.', filter: 'dns.flags.rcode != 0' },
    { title: 'Requêtes ARP sans réponse', text: 'L’hôte cherche une adresse MAC que personne ne fournit : passerelle ou voisin absent.', filter: 'arp.opcode == 1' },
];

export default function Wireshark({ quiz }: { quiz: Quiz | null }) {
    const { level } = usePreferences();
    const [mode, setMode] = useState<Mode>(level >= 3 ? 'advanced' : 'beginner');
    const [imported, setImported] = useState<{ capture: Capture; warnings: string[] } | null>(null);
    const all = useMemo(() => (imported ? [...captures, imported.capture] : captures), [imported]);
    const [captureId, setCaptureId] = useState(captures[0].id);
    const capture = all.find((item) => item.id === captureId) ?? captures[0];
    const [draft, setDraft] = useState('');
    const [applied, setApplied] = useState('');
    const [selected, setSelected] = useState<number | null>(null);

    const draftResult = useMemo(() => compileFilter(draft), [draft]);
    const appliedResult = useMemo(() => compileFilter(applied), [applied]);
    const visible = useMemo(() => (appliedResult.ok ? capture.packets.filter(appliedResult.match) : capture.packets), [appliedResult, capture]);
    const packet = capture.packets.find((item) => item.no === selected) ?? null;

    const switchCapture = (id: string, filter = '') => {
        setCaptureId(id);
        setSelected(null);
        setDraft(filter);
        setApplied(filter);
    };

    useAssistantContext({
        page: 'wireshark',
        title: 'Apprendre à lire Wireshark',
        focus: packet ? `Paquet ${packet.no} : ${packet.protocol} — ${packet.info}` : applied ? `Filtre ${applied}` : capture.title,
    });

    const apply = (value: string) => {
        setDraft(value);
        if (compileFilter(value).ok) setApplied(value);
    };

    return (
        <>
            <PageHeader
                eyebrow="Analyse de trafic"
                title="Apprendre à lire Wireshark"
                description="Wireshark montre les paquets qui passent réellement sur une interface. Ici, tu t’entraînes sur des captures pédagogiques construites pour être cohérentes, avec des explications à chaque ligne."
            />

            <Section className="pt-0">
                <div className="flex flex-wrap items-center gap-3">
                    <div role="radiogroup" aria-label="Mode d’affichage" className="inline-flex rounded-lg border border-line bg-surface/60 p-1">
                        {(['beginner', 'advanced'] as const).map((value) => (
                            <button
                                key={value}
                                role="radio"
                                aria-checked={mode === value}
                                onClick={() => setMode(value)}
                                className={cn('rounded-md px-3 py-1.5 text-sm transition', mode === value ? 'bg-electric/20 text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            >
                                {value === 'beginner' ? 'Mode débutant' : 'Mode avancé'}
                            </button>
                        ))}
                    </div>
                    <label className="flex min-w-0 max-w-full items-center gap-2 text-sm">
                        <span className="shrink-0 whitespace-nowrap text-muted-foreground">Capture :</span>
                        <select
                            value={capture.id}
                            onChange={(event) => switchCapture(event.target.value)}
                            className="min-w-0 max-w-full truncate rounded-md border border-line bg-night-800 px-2 py-1.5 text-sm"
                        >
                            {all.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Badge variant="outline" className={capture.pedagogical ? 'border-signal/40 text-signal' : 'border-warn/40 text-warn'}>
                        {capture.pedagogical ? 'Capture pédagogique (données illustratives)' : 'Capture importée — analyse basique'}
                    </Badge>
                </div>
                <p className="mt-3 max-w-4xl text-sm text-muted-foreground">{capture.description}</p>
                {!capture.pedagogical && imported && imported.warnings.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-warn">
                        {imported.warnings.map((warning) => (
                            <li key={warning} className="flex gap-1.5">
                                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                                {warning}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-5">
                    <FilterBar
                        value={draft}
                        onChange={setDraft}
                        onApply={apply}
                        error={draftResult.ok ? null : draftResult.error}
                        count={visible.length}
                        total={capture.packets.length}
                    />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <div className="min-w-0 space-y-3">
                        <PacketTable packets={visible} selected={selected} onSelect={setSelected} />
                        <div className="flex flex-wrap gap-2 text-[11px]" aria-label="Légende des couleurs">
                            {legend.map((item) => (
                                <span key={item.color} className={cn('rounded px-2 py-0.5 ring-1 ring-line', rowColor[item.color])}>
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="min-w-0">
                        {packet ? (
                            <PacketDetails packet={packet} mode={mode} onUseFilter={apply} />
                        ) : (
                            <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-line bg-surface/40 p-6 text-center text-sm text-muted-foreground">
                                <FileSearch className="mb-2 size-6" />
                                Sélectionne un paquet dans la liste (clic, ou flèches du clavier) pour voir son détail.
                            </div>
                        )}
                    </div>
                </div>

                {capture.missions.length > 0 && (
                    <div className="mt-6">
                        <Missions key={capture.id} missions={capture.missions} selected={selected} visible={visible.map((item) => item.no)} filterApplied={applied} />
                    </div>
                )}

                <div className="mt-6">
                    <PcapImport
                        onLoaded={(loaded, warnings) => {
                            setImported({ capture: loaded, warnings });
                            switchCapture(loaded.id);
                        }}
                    />
                </div>
            </Section>

            <Section title="Lire la liste des paquets" description="Chaque ligne est un paquet. Les colonnes par défaut :">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {columns.map((column) => (
                        <div key={column.name} className="rounded-xl border border-line bg-surface/40 p-4">
                            <dt className="font-mono text-sm text-signal">{column.name}</dt>
                            <dd className="mt-1 text-sm text-muted-foreground">{column.text}</dd>
                        </div>
                    ))}
                </dl>
                <p className="mt-4 flex gap-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0 text-electric" />
                    Les couleurs de lignes reprennent l’esprit des règles par défaut de Wireshark ; elles sont configurables dans le vrai logiciel (View → Coloring Rules).
                </p>
            </Section>

            <Section title="Filtre d’affichage ou filtre de capture ?">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-line bg-surface/40 p-5">
                        <h3 className="flex items-center gap-2 font-semibold">
                            <Filter className="size-4 text-signal" /> Filtre d’affichage
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Masque des paquets <strong>déjà capturés</strong>. On peut le changer à volonté sans rien perdre. Syntaxe propre à Wireshark : <code className="font-mono text-signal">dns</code>,{' '}
                            <code className="font-mono text-signal">ip.addr == 192.168.1.10</code>, <code className="font-mono text-signal">tcp.port == 443</code>.
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            C’est ce type de filtre que tu utilises ci-dessus. Ce moteur pédagogique reconnaît un sous-ensemble de la syntaxe (protocoles, champs courants, ==, !=, &lt;, &gt;, contains, &&, ||, !).
                        </p>
                    </div>
                    <div className="rounded-xl border border-line bg-surface/40 p-5">
                        <h3 className="flex items-center gap-2 font-semibold">
                            <EyeOff className="size-4 text-warn" /> Filtre de capture
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Décide <strong>avant</strong> la capture ce qui est enregistré. Ce qui est exclu est perdu définitivement. Syntaxe BPF (celle de tcpdump/libpcap), différente :
                        </p>
                        <ul className="mt-2 space-y-1 text-sm">
                            {captureFilters.map((item) => (
                                <li key={item.bpf}>
                                    <code className="font-mono text-warn">{item.bpf}</code> <span className="text-muted-foreground">— {item.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Section>

            <Section title="Ce que l’on voit… et ce que l’on ne voit pas avec HTTPS">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-ok/30 bg-ok/5 p-5">
                        <h3 className="flex items-center gap-2 font-semibold">
                            <Eye className="size-4 text-ok" /> Visible dans une capture ordinaire
                        </h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            <li>Adresses IP, ports, tailles et horodatage des paquets</li>
                            <li>Requêtes DNS classiques (non chiffrées) : le nom demandé</li>
                            <li>La poignée de main TCP</li>
                            <li>Le nom du site dans le SNI du ClientHello (sauf si ECH est utilisé)</li>
                            <li>La version TLS négociée et la suite choisie (ServerHello)</li>
                        </ul>
                    </div>
                    <div className="rounded-xl border border-violet/30 bg-violet/5 p-5">
                        <h3 className="flex items-center gap-2 font-semibold">
                            <Lock className="size-4 text-violet" /> Chiffré, donc illisible
                        </h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            <li>L’URL complète, les en-têtes et le corps HTTP</li>
                            <li>Les cookies, mots de passe, contenus de formulaires</li>
                            <li>En TLS 1.3, le certificat du serveur lui-même</li>
                        </ul>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Wireshark n’affiche le contenu déchiffré que si on lui fournit les clés de session (fichier SSLKEYLOGFILE de son propre navigateur, par exemple). Compare les captures « Visite HTTPS » et « HTTP en clair ».
                        </p>
                    </div>
                </div>
            </Section>

            <Section title="Signaux utiles au diagnostic" description="Clique sur un filtre pour l’appliquer à la capture sélectionnée (la capture « Diagnostic » en contient plusieurs).">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {signals.map((signal) => (
                        <div key={signal.title} className="flex flex-col rounded-xl border border-line bg-surface/40 p-4">
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                                <Stethoscope className="size-4 text-danger" />
                                {signal.title}
                            </h3>
                            <p className="mt-1 flex-1 text-sm text-muted-foreground">{signal.text}</p>
                            <button
                                className="mt-3 self-start rounded-md bg-night-800 px-2 py-1 font-mono text-xs text-signal ring-1 ring-line hover:ring-signal/50"
                                onClick={() => {
                                    switchCapture(capture.pedagogical ? 'diagnostic' : capture.id, signal.filter);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            >
                                {signal.filter}
                            </button>
                        </div>
                    ))}
                </div>
            </Section>

            <Section title="Capturer de façon responsable">
                <div className="flex gap-3 rounded-xl border border-warn/30 bg-warn/5 p-5 text-sm text-muted-foreground">
                    <Scale className="mt-0.5 size-5 shrink-0 text-warn" />
                    <p>
                        Capture uniquement sur un réseau qui t’appartient ou avec une autorisation explicite. Une capture peut contenir des données personnelles (noms de sites visités, identifiants
                        transmis en clair) : ne la partage pas sans l’avoir anonymisée, et supprime-la lorsqu’elle n’est plus utile.
                    </p>
                </div>
            </Section>

            {quiz && (
                <Section title={<span className="flex items-center gap-2"><GraduationCap className="size-6 text-signal" /> Vérifie tes acquis</span>}>
                    <QuizRunner quiz={quiz} />
                </Section>
            )}
        </>
    );
}
