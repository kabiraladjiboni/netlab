import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { TermLink } from './term-link';

/**
 * Mini-syntaxe des contenus pédagogiques :
 *  - [[slug]] ou [[slug|texte affiché]] : terme du dictionnaire cliquable ;
 *  - **gras** ;
 *  - `code` (adresses, ports, commandes) ;
 *  - une ligne vide sépare deux paragraphes.
 */
const TOKEN = /(\[\[[a-z0-9-]+(?:\|[^\]]+)?\]\]|\*\*[^*]+\*\*|`[^`]+`)/g;

export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
    const parts = text.split(TOKEN).filter((part) => part !== '');
    return parts.map((part, index) => {
        const key = `${keyPrefix}-${index}`;
        if (part.startsWith('[[')) {
            const inner = part.slice(2, -2);
            const [slug, label] = inner.split('|');
            return <TermLink key={key} slug={slug} label={label ?? slug} />;
        }
        if (part.startsWith('**')) {
            return <strong key={key}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`')) {
            return <code key={key}>{part.slice(1, -1)}</code>;
        }
        return <Fragment key={key}>{part}</Fragment>;
    });
}

export function RichText({ text, className }: { text: string; className?: string }) {
    const paragraphs = text.split(/\n\s*\n/);
    return (
        <div className={className ?? 'prose-net'}>
            {paragraphs.map((paragraph, index) => {
                const lines = paragraph.split('\n');
                if (lines.every((line) => line.trim().startsWith('- '))) {
                    return (
                        <ul key={index} className="mt-2 list-disc space-y-1 pl-5">
                            {lines.map((line, i) => (
                                <li key={i}>{renderInline(line.trim().slice(2), `l${index}-${i}`)}</li>
                            ))}
                        </ul>
                    );
                }
                return <p key={index}>{renderInline(paragraph, `p${index}`)}</p>;
            })}
        </div>
    );
}

/** Retire la mini-syntaxe pour obtenir du texte brut (lecteurs d'écran, IA). */
export function plainText(text: string): string {
    return text
        .replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([a-z0-9-]+)\]\]/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1');
}
