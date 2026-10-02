import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
    'w-full rounded-xl border border-input bg-night-850 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/25 disabled:opacity-60 aria-[invalid=true]:border-danger';

type FieldProps = { label: ReactNode; error?: string; hint?: ReactNode; required?: boolean; children: (id: string, describedBy: string | undefined) => ReactNode; className?: string };

export function Field({ label, error, hint, required, children, className }: FieldProps) {
    const id = useId();
    const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
    return (
        <div className={cn('space-y-1.5', className)}>
            <label htmlFor={id} className="block text-sm font-medium">
                {label}
                {required && <span className="ml-0.5 text-danger" aria-hidden> *</span>}
            </label>
            {children(id, describedBy)}
            {hint && !error && (
                <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} className="text-xs font-medium text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: ReactNode; error?: string; hint?: ReactNode; onChange: (value: string) => void; value: string | number | null | undefined };

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, error, hint, onChange, value, className, required, type = 'text', ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const isPassword = type === 'password';
    return (
        <Field label={label} error={error} hint={hint} required={required} className={className}>
            {(id, describedBy) => (
                <div className="relative">
                    <input
                        ref={ref}
                        id={id}
                        type={isPassword && visible ? 'text' : type}
                        value={value ?? ''}
                        onChange={(event) => onChange(event.target.value)}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy}
                        required={required}
                        className={cn(inputClass, isPassword && 'pr-11')}
                        {...props}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setVisible((v) => !v)}
                            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                        </button>
                    )}
                </div>
            )}
        </Field>
    );
});

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { label: ReactNode; error?: string; hint?: ReactNode; onChange: (value: string) => void; value: string | null | undefined; mono?: boolean };

export function TextArea({ label, error, hint, onChange, value, className, required, rows = 4, mono, ...props }: TextAreaProps) {
    return (
        <Field label={label} error={error} hint={hint} required={required} className={className}>
            {(id, describedBy) => (
                <textarea
                    id={id}
                    rows={rows}
                    value={value ?? ''}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    required={required}
                    className={cn(inputClass, 'leading-relaxed', mono && 'font-mono text-[13px]')}
                    {...props}
                />
            )}
        </Field>
    );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
    label: ReactNode;
    error?: string;
    hint?: ReactNode;
    onChange: (value: string) => void;
    value: string | number | null | undefined;
    options: { value: string | number; label: string }[];
    placeholder?: string;
};

export function SelectField({ label, error, hint, onChange, value, options, placeholder, className, required, ...props }: SelectFieldProps) {
    return (
        <Field label={label} error={error} hint={hint} required={required} className={className}>
            {(id, describedBy) => (
                <select
                    id={id}
                    value={value ?? ''}
                    onChange={(event) => onChange(event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className={cn(inputClass, 'pr-8')}
                    {...props}
                >
                    {placeholder !== undefined && <option value="">{placeholder}</option>}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            )}
        </Field>
    );
}

export function Checkbox({ label, checked, onChange, error, hint, className }: { label: ReactNode; checked: boolean; onChange: (value: boolean) => void; error?: string; hint?: ReactNode; className?: string }) {
    const id = useId();
    return (
        <div className={className}>
            <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug">
                <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-signal)]" aria-invalid={error ? true : undefined} />
                <span>{label}</span>
            </label>
            {hint && !error && <p className="mt-1 pl-6.5 text-xs text-muted-foreground">{hint}</p>}
            {error && (
                <p className="mt-1 pl-6.5 text-xs font-medium text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

export function SubmitButton({ children, processing, className, variant = 'primary', ...props }: { children: ReactNode; processing?: boolean; className?: string; variant?: 'primary' | 'danger' | 'outline' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type="submit"
            disabled={processing || props.disabled}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                variant === 'primary' && 'bg-signal text-on-accent hover:brightness-110',
                variant === 'danger' && 'bg-danger text-white hover:brightness-110',
                variant === 'outline' && 'border border-line hover:bg-night-800',
                className,
            )}
            {...props}
        >
            {processing && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
            {children}
        </button>
    );
}

/** Message d'erreur global en tête de formulaire. */
export function FormErrors({ errors }: { errors: Record<string, string | undefined> }) {
    const list = Object.values(errors).filter(Boolean) as string[];
    if (list.length === 0) return null;
    return (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
            <p className="font-semibold text-danger">{list.length === 1 ? 'Une correction est nécessaire :' : `${list.length} corrections sont nécessaires :`}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {list.slice(0, 8).map((message, index) => (
                    <li key={index}>{message}</li>
                ))}
            </ul>
        </div>
    );
}
