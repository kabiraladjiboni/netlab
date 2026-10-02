import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Level } from '@/hooks/use-preferences';
import { AssistantSheet } from './assistant-sheet';

export type AssistantContextData = {
    /** Type de page : leçon, protocole, wireshark… */
    page: string;
    /** Titre lisible du contenu consulté. */
    title?: string;
    /** Étape ou élément sélectionné. */
    focus?: string;
    /** Texte pédagogique affiché à l'étudiant (sert de contexte validé). */
    excerpt?: string;
    /** Slugs de concepts liés (protocoles, termes). */
    concepts?: string[];
};

type AssistantApi = {
    open: (question?: string, context?: AssistantContextData) => void;
    setPageContext: (context: AssistantContextData | null) => void;
};

const AssistantApiContext = createContext<AssistantApi | null>(null);

export function AssistantProvider({ children, level }: { children: ReactNode; level: Level }) {
    const [isOpen, setOpen] = useState(false);
    const [pageContext, setPageContextState] = useState<AssistantContextData | null>(null);
    const [override, setOverride] = useState<AssistantContextData | null>(null);
    const [pendingQuestion, setPendingQuestion] = useState<string | undefined>();

    const open = useCallback((question?: string, context?: AssistantContextData) => {
        setOverride(context ?? null);
        setPendingQuestion(question);
        setOpen(true);
    }, []);

    const setPageContext = useCallback((context: AssistantContextData | null) => setPageContextState(context), []);
    const api = useMemo(() => ({ open, setPageContext }), [open, setPageContext]);

    return (
        <AssistantApiContext.Provider value={api}>
            {children}
            <AssistantSheet
                open={isOpen}
                onOpenChange={setOpen}
                context={override ?? pageContext}
                level={level}
                initialQuestion={pendingQuestion}
                onQuestionConsumed={() => setPendingQuestion(undefined)}
            />
        </AssistantApiContext.Provider>
    );
}

export function useAssistant(): AssistantApi {
    const api = useContext(AssistantApiContext);
    if (!api) throw new Error('useAssistant doit être utilisé dans <AssistantProvider>.');
    return api;
}

/** Déclare le contexte pédagogique de la page courante pour l'assistant. */
export function useAssistantContext(context: AssistantContextData | null) {
    const { setPageContext } = useAssistant();
    const serialized = JSON.stringify(context);
    const ref = useRef(context);
    ref.current = context;
    useEffect(() => {
        setPageContext(ref.current);
        return () => setPageContext(null);
    }, [serialized, setPageContext]);
}
