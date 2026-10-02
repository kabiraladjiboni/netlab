import { Link } from '@inertiajs/react';
import { Bot, CircleAlert, Loader2, SendHorizontal, Sparkles, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { RichText } from '@/components/content/rich-text';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { LEVELS } from '@/hooks/use-preferences';
import type { Level } from '@/hooks/use-preferences';
import { postJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { AssistantContextData } from './assistant-provider';

type Source = { label: string; href: string };
type AssistantResponse = { answer: string; mode: 'ai' | 'fallback'; sources: Source[]; notice?: string | null };
type Message = { role: 'user' | 'assistant'; content: string; mode?: AssistantResponse['mode']; sources?: Source[]; notice?: string | null; error?: boolean };

const GENERAL_SUGGESTIONS = [
    "Quelle est la différence entre une adresse IP privée et publique ?",
    'Pourquoi DNS est-il nécessaire ?',
    "Pourquoi l'adresse IP change-t-elle avec le NAT ?",
    'Quelle est la différence entre un routeur et un commutateur ?',
    'Pourquoi TCP utilise-t-il SYN et ACK ?',
    'Quelle est la différence entre VLAN et sous-réseau ?',
];

export function AssistantSheet({
    open,
    onOpenChange,
    context,
    level,
    initialQuestion,
    onQuestionConsumed,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    context: AssistantContextData | null;
    level: Level;
    initialQuestion?: string;
    onQuestionConsumed: () => void;
}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const mobile = useMediaQuery('(max-width: 639px)');
    const abortRef = useRef<AbortController | null>(null);

    const ask = async (question: string) => {
        const trimmed = question.trim();
        if (!trimmed || loading) return;
        setMessages((previous) => [...previous, { role: 'user', content: trimmed }]);
        setInput('');
        setLoading(true);
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const response = await postJson<AssistantResponse>(
                '/api/assistant',
                {
                    question: trimmed,
                    level,
                    context: context ?? { page: 'general' },
                    history: messages.slice(-6).map((message) => ({ role: message.role, content: message.content.slice(0, 1500) })),
                },
                controller.signal,
            );
            setMessages((previous) => [
                ...previous,
                { role: 'assistant', content: response.answer, mode: response.mode, sources: response.sources, notice: response.notice },
            ]);
        } catch (error) {
            if ((error as Error).name === 'AbortError') return;
            setMessages((previous) => [
                ...previous,
                {
                    role: 'assistant',
                    error: true,
                    content:
                        (error as { status?: number }).status === 429
                            ? 'Trop de questions en peu de temps. Patiente une minute avant de réessayer.'
                            : "L'assistant est momentanément indisponible. Les explications des leçons et le dictionnaire restent accessibles.",
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && initialQuestion) {
            void ask(initialQuestion);
            onQuestionConsumed();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialQuestion]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        void ask(input);
    };

    const suggestions = context?.focus
        ? [`Peux-tu m'expliquer autrement : « ${context.focus} » ?`, 'Que se passerait-il si cette étape échouait ?', ...GENERAL_SUGGESTIONS.slice(0, 3)]
        : GENERAL_SUGGESTIONS;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side={mobile ? 'bottom' : 'right'} className={cn('gap-0 p-0', mobile ? 'h-[88dvh] rounded-t-3xl' : 'w-full sm:max-w-md')}>
                <SheetHeader className="border-b border-line px-5 pt-5 pb-4">
                    <SheetTitle className="flex items-center gap-2 font-display text-lg">
                        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-signal to-[color-mix(in_oklab,var(--color-signal)_70%,var(--color-gold))] text-on-accent">
                            <Sparkles className="size-4" aria-hidden />
                        </span>
                        Assistant pédagogique
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                        Niveau : <strong className="text-foreground">{LEVELS.find((item) => item.value === level)?.label}</strong>
                        {context?.title && (
                            <>
                                {' '}
                                · Contexte : <strong className="text-foreground">{context.title}</strong>
                                {context.focus && <> — {context.focus}</>}
                            </>
                        )}
                    </SheetDescription>
                </SheetHeader>

                <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4 scrollbar-thin" aria-live="polite">
                    {messages.length === 0 && (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Pose une question sur ce que tu observes. Les réponses s'appuient sur les contenus validés de la plateforme et sur le contexte de la page.
                            </p>
                            <ul className="space-y-2">
                                {suggestions.map((suggestion) => (
                                    <li key={suggestion}>
                                        <button
                                            type="button"
                                            onClick={() => void ask(suggestion)}
                                            className="w-full rounded-xl border border-line bg-night-900/50 px-3 py-2 text-left text-sm transition-colors hover:border-signal/60 hover:bg-night-800"
                                        >
                                            {suggestion}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {messages.map((message, index) => (
                        <div key={index} className={cn('flex gap-2.5', message.role === 'user' && 'flex-row-reverse')}>
                            <span
                                className={cn(
                                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                                    message.role === 'user' ? 'bg-night-700' : message.error ? 'bg-danger/20 text-danger' : 'bg-signal/15 text-signal',
                                )}
                                aria-hidden
                            >
                                {message.role === 'user' ? <User className="size-3.5" /> : message.error ? <CircleAlert className="size-3.5" /> : <Bot className="size-3.5" />}
                            </span>
                            <div
                                className={cn(
                                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                                    message.role === 'user' ? 'bg-electric/25' : 'border border-line bg-night-900/60',
                                )}
                            >
                                <span className="sr-only">{message.role === 'user' ? 'Toi :' : 'Assistant :'}</span>
                                {message.role === 'assistant' ? <RichText text={message.content} className="prose-net text-sm" /> : message.content}
                                {message.notice && <p className="mt-2 rounded-lg bg-warn/10 px-2 py-1.5 text-[11.5px] text-warn">{message.notice}</p>}
                                {message.sources && message.sources.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {message.sources.map((source) => (
                                            <Link
                                                key={source.href}
                                                href={source.href}
                                                onClick={() => onOpenChange(false)}
                                                className="rounded-full border border-line px-2 py-0.5 text-[11px] text-signal hover:border-signal/60"
                                            >
                                                {source.label}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" aria-hidden /> Recherche d'une explication…
                        </p>
                    )}
                </div>

                <form onSubmit={submit} className="border-t border-line p-3">
                    <label htmlFor="assistant-question" className="sr-only">
                        Ta question
                    </label>
                    <div className="flex items-end gap-2 rounded-2xl border border-line bg-night-900/70 p-1.5 focus-within:border-signal/70">
                        <textarea
                            id="assistant-question"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    void ask(input);
                                }
                            }}
                            rows={1}
                            maxLength={600}
                            placeholder="Ex. : Pourquoi le port source change-t-il ?"
                            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="flex size-10 items-center justify-center rounded-xl bg-signal text-on-accent transition hover:brightness-110 disabled:opacity-40"
                            aria-label="Envoyer la question"
                        >
                            <SendHorizontal className="size-4" aria-hidden />
                        </button>
                    </div>
                    <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                        L'assistant peut se tromper : vérifie avec les fiches et le dictionnaire.
                    </p>
                </form>
            </SheetContent>
        </Sheet>
    );
}
