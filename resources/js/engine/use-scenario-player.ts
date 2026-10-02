import { useAnimationFrame, useMotionValue } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { computeTimeline } from './timeline';
import type { StepTimeline } from './timeline';
import type { Scenario } from './types';

/**
 * État explicite du moteur :
 * - playing  : lecture automatique, enchaîne les étapes ;
 * - stepping : l'étape courante joue son animation puis s'arrête (navigation manuelle) ;
 * - paused   : horloge figée ;
 * - ended    : fin du scénario.
 */
export type PlayerStatus = 'playing' | 'stepping' | 'paused' | 'ended';

export const SPEEDS = [0.5, 1, 1.5] as const;
export type Speed = (typeof SPEEDS)[number];

export type PlayerState = {
    index: number;
    status: PlayerStatus;
    speed: Speed;
    /** Incrémenté à chaque (re)démarrage d'étape pour réinitialiser l'horloge. */
    epoch: number;
};

export type PlayerAction =
    | { type: 'play' }
    | { type: 'pause' }
    | { type: 'toggle' }
    | { type: 'next' }
    | { type: 'prev' }
    | { type: 'goto'; index: number }
    | { type: 'replay' }
    | { type: 'restart' }
    | { type: 'speed'; speed: Speed }
    | { type: 'motionDone' }
    | { type: 'stepDone' }
    | { type: 'reset' };

export function createPlayerReducer(stepCount: number) {
    const last = Math.max(0, stepCount - 1);
    return function reducer(state: PlayerState, action: PlayerAction): PlayerState {
        const moveTo = (index: number): PlayerState => ({
            ...state,
            index: Math.min(last, Math.max(0, index)),
            status: state.status === 'playing' ? 'playing' : 'stepping',
            epoch: state.epoch + 1,
        });
        switch (action.type) {
            case 'play':
                if (state.status === 'ended') return { ...state, index: 0, status: 'playing', epoch: state.epoch + 1 };
                return { ...state, status: 'playing' };
            case 'pause':
                return state.status === 'ended' ? state : { ...state, status: 'paused' };
            case 'toggle':
                return reducer(state, { type: state.status === 'playing' ? 'pause' : 'play' });
            case 'next':
                if (state.index >= last) return { ...state, status: 'ended' };
                return moveTo(state.index + 1);
            case 'prev':
                return moveTo(state.index - 1);
            case 'goto':
                return moveTo(action.index);
            case 'replay':
                return { ...state, status: state.status === 'playing' ? 'playing' : 'stepping', epoch: state.epoch + 1 };
            case 'restart':
                return { ...state, index: 0, status: 'playing', epoch: state.epoch + 1 };
            case 'speed':
                return { ...state, speed: action.speed };
            case 'motionDone':
                return state.status === 'stepping' ? { ...state, status: 'paused' } : state;
            case 'stepDone':
                if (state.status !== 'playing') return state;
                if (state.index >= last) return { ...state, status: 'ended' };
                return { ...state, index: state.index + 1, epoch: state.epoch + 1 };
            case 'reset':
                return { index: 0, status: 'paused', speed: state.speed, epoch: state.epoch + 1 };
            default:
                return state;
        }
    };
}

export type ScenarioPlayer = {
    state: PlayerState;
    dispatch: (action: PlayerAction) => void;
    time: MotionValue<number>;
    timeline: StepTimeline;
    step: Scenario['steps'][number];
    isFirst: boolean;
    isLast: boolean;
};

export function useScenarioPlayer(scenario: Scenario, stepText: (index: number) => string): ScenarioPlayer {
    const reducer = useMemo(() => createPlayerReducer(scenario.steps.length), [scenario.steps.length]);
    const [state, dispatch] = useReducer(reducer, { index: 0, status: 'paused', speed: 1, epoch: 0 } satisfies PlayerState);
    const time = useMotionValue(0);
    const step = scenario.steps[Math.min(state.index, scenario.steps.length - 1)];
    const text = stepText(state.index);
    const timeline = useMemo(() => computeTimeline(step, text), [step, text]);

    // Changement de scénario (variante) : on revient au début.
    const scenarioRef = useRef(scenario.id);
    useEffect(() => {
        if (scenarioRef.current !== scenario.id) {
            scenarioRef.current = scenario.id;
            dispatch({ type: 'reset' });
        }
    }, [scenario.id]);

    // Nouvelle étape ou rejouer : l'horloge repart de zéro.
    useEffect(() => {
        time.set(0);
    }, [state.epoch, time]);

    const signalled = useRef({ epoch: -1, motion: false, step: false });

    useAnimationFrame((_, delta) => {
        if (state.status !== 'playing' && state.status !== 'stepping') return;
        if (signalled.current.epoch !== state.epoch) {
            signalled.current = { epoch: state.epoch, motion: false, step: false };
        }
        const dt = Math.min(delta, 100) / 1000;
        const next = time.get() + dt * state.speed;

        if (state.status === 'stepping') {
            if (next >= timeline.motionEnd) {
                time.set(timeline.motionEnd);
                if (!signalled.current.motion) {
                    signalled.current.motion = true;
                    dispatch({ type: 'motionDone' });
                }
                return;
            }
            time.set(next);
            return;
        }

        time.set(Math.min(next, timeline.duration));
        if (next >= timeline.duration && !signalled.current.step) {
            signalled.current.step = true;
            dispatch({ type: 'stepDone' });
        }
    });

    const safeDispatch = useCallback((action: PlayerAction) => dispatch(action), []);

    return {
        state,
        dispatch: safeDispatch,
        time,
        timeline,
        step,
        isFirst: state.index === 0,
        isLast: state.index === scenario.steps.length - 1,
    };
}
