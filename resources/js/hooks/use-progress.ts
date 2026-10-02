import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from '@/lib/storage';

/**
 * Suivi de progression local (navigateur). Aucune donnée n'est envoyée au
 * serveur : la plateforme ne possède pas encore de comptes utilisateurs.
 */
export type LessonProgress = { visitedSteps: number; totalSteps: number; completed: boolean; updatedAt: string };
export type QuizResult = { score: number; total: number; updatedAt: string };
export type ProgressState = {
    lessons: Record<string, LessonProgress>;
    quizzes: Record<string, QuizResult>;
    diagnostics: Record<string, { solved: boolean; hintsUsed: number }>;
};

const KEY = 'netlab.progress.v1';
const empty: ProgressState = { lessons: {}, quizzes: {}, diagnostics: {} };
let state: ProgressState | null = null;
const listeners = new Set<() => void>();

function current(): ProgressState {
    if (state === null) {
        const stored = readStorage<ProgressState>(KEY, empty);
        state = { ...empty, ...stored };
    }
    return state;
}

function update(mutator: (draft: ProgressState) => ProgressState): void {
    state = mutator(current());
    writeStorage(KEY, state);
    listeners.forEach((listener) => listener());
}

export const progressStore = {
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
    get: current,
    recordLessonStep(slug: string, stepIndex: number, totalSteps: number) {
        const previous = current().lessons[slug];
        const visited = Math.max(previous?.visitedSteps ?? 0, stepIndex + 1);
        if (previous && previous.visitedSteps >= visited && previous.totalSteps === totalSteps) return;
        update((draft) => ({
            ...draft,
            lessons: {
                ...draft.lessons,
                [slug]: {
                    visitedSteps: visited,
                    totalSteps,
                    completed: previous?.completed ?? false,
                    updatedAt: new Date().toISOString(),
                },
            },
        }));
    },
    completeLesson(slug: string, totalSteps: number) {
        update((draft) => ({
            ...draft,
            lessons: {
                ...draft.lessons,
                [slug]: { visitedSteps: totalSteps, totalSteps, completed: true, updatedAt: new Date().toISOString() },
            },
        }));
    },
    recordQuiz(slug: string, score: number, total: number) {
        update((draft) => {
            const best = draft.quizzes[slug];
            if (best && best.score >= score) return draft;
            return { ...draft, quizzes: { ...draft.quizzes, [slug]: { score, total, updatedAt: new Date().toISOString() } } };
        });
    },
    recordDiagnostic(slug: string, solved: boolean, hintsUsed: number) {
        update((draft) => ({ ...draft, diagnostics: { ...draft.diagnostics, [slug]: { solved, hintsUsed } } }));
    },
    reset() {
        update(() => empty);
    },
};

export function useProgress(): ProgressState {
    return useSyncExternalStore(progressStore.subscribe, progressStore.get, () => empty);
}
