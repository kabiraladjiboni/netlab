import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Supprime les accents et met en minuscules (recherche tolérante). */
export function normalize(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
