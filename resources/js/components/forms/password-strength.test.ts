import { describe, expect, it } from 'vitest';
import { passwordScore } from './password-strength';

describe('passwordScore', () => {
    it('vide = 0, moins de 12 caractères = trop faible', () => {
        expect(passwordScore('')).toBe(0);
        expect(passwordScore('Ab1!xyz')).toBe(1);
    });
    it('refuse les mots de passe courants même longs', () => {
        expect(passwordScore('motdepasse2026!!')).toBe(1);
        expect(passwordScore('aaaaaaaaaaaaaaaa')).toBe(1);
    });
    it('valorise la longueur plus que la composition', () => {
        expect(passwordScore('trois mots simples')).toBeGreaterThanOrEqual(3);
        expect(passwordScore('le routeur chante au lever du soleil')).toBe(4);
    });
    it('pénalise les suites évidentes', () => {
        expect(passwordScore('Bureau#1234Zz')).toBeLessThan(passwordScore('Bureau#8371Zz'));
    });
});
