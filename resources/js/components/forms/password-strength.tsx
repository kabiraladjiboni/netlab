import { cn } from '@/lib/utils';

const COMMON = ['password', 'motdepasse', 'azerty', 'qwerty', '123456', 'abc123', 'admin', 'bonjour', 'soleil', 'iloveyou', 'aboro', 'netlab'];

/**
 * Estimation indicative (dans le navigateur, rien n'est envoyé) : la longueur compte
 * le plus. Le serveur reste seul juge (12 caractères minimum, mots de passe divulgués refusés).
 */
export function passwordScore(value: string): 0 | 1 | 2 | 3 | 4 {
    if (value.length === 0) return 0;
    const lower = value.toLowerCase();
    // Un mot courant n'est pénalisant que s'il constitue l'essentiel du mot de passe.
    const rest = COMMON.reduce((text, word) => text.split(word).join(''), lower).replace(/[\d\W_]/g, '');
    if (value.length < 12 || rest.length < 6 || /^(.)\1+$/.test(value)) return 1;
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
    const words = value.trim().split(/[\s\-_.]+/).filter((part) => part.length >= 3).length;
    let score = 2;
    if (value.length >= 16 || (value.length >= 12 && classes >= 3)) score = 3;
    if (value.length >= 20 || (value.length >= 16 && (classes >= 3 || words >= 4))) score = 4;
    if (/(0123|1234|2345|3456|4567|5678|6789|abcd|azer|qwer)/i.test(value) && score > 2) score -= 1;
    return score as 2 | 3 | 4;
}

const LABELS = ['', 'Trop faible', 'Correct', 'Solide', 'Excellent'];
const COLORS = ['', 'bg-danger', 'bg-warn', 'bg-ok', 'bg-ok'];

export function PasswordStrength({ value }: { value: string }) {
    const score = passwordScore(value);
    if (score === 0) {
        return <p className="text-xs text-muted-foreground">12 caractères minimum. Astuce : une phrase de passe de plusieurs mots est facile à retenir et très solide.</p>;
    }
    return (
        <div className="space-y-1" aria-live="polite">
            <div className="flex gap-1" aria-hidden>
                {[1, 2, 3, 4].map((step) => (
                    <span key={step} className={cn('h-1.5 flex-1 rounded-full bg-night-700', step <= score && COLORS[score])} />
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
                Robustesse estimée : <strong className="text-foreground">{LABELS[score]}</strong>
                {value.length < 12 && ` · encore ${12 - value.length} caractère${12 - value.length > 1 ? 's' : ''}`}
            </p>
        </div>
    );
}
