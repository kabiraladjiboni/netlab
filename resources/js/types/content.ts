/** Types partagés des contenus servis par Laravel (props Inertia et /api). */

export type TermSummary = { slug: string; term: string };

export type TermDetail = {
    slug: string;
    term: string;
    aliases: string[];
    category: string | null;
    simple: string;
    technical: string;
    example: string | null;
    related: TermSummary[];
    protocols: { slug: string; acronym: string; name: string }[];
};

export type ProtocolSummary = {
    slug: string;
    acronym: string;
    name: string;
    summary: string;
    status: ProtocolStatus;
    completeness: 'complete' | 'essential';
    category: { slug: string; name: string } | null;
    layers: { model: 'osi' | 'tcpip'; number: number; slug: string; name: string }[];
    ports: PortInfo[];
};

export type ProtocolStatus = 'standard' | 'extension' | 'mechanism' | 'tool' | 'proprietary' | 'certification' | 'open-source';

export type PortInfo = { number: string; transport: string; note?: string };

export type Reference = { label: string; url?: string };

export type ProtocolDetail = ProtocolSummary & {
    problem: string;
    beginner: string;
    analogy: string;
    real_example: string | null;
    osi_note: string | null;
    tcpip_note: string | null;
    communication: { from: string; to: string; message: string; note?: string }[];
    fields: { name: string; size?: string; description: string }[];
    packet_example: { title: string; lines: string[]; note?: string } | null;
    mistakes: string[];
    limits: string[];
    variants: string[];
    references: Reference[];
    lesson: { slug: string; title: string; href: string } | null;
    scenario: string | null;
    related: { slug: string; acronym: string; name: string; type: string; type_label: string; note: string | null }[];
    terms: TermSummary[];
    quiz: Quiz | null;
};

export type QuizQuestion =
    | { id: string; type: 'single'; prompt: string; options: string[]; answer: number; explanation: string; context?: string }
    | { id: string; type: 'multiple'; prompt: string; options: string[]; answer: number[]; explanation: string; context?: string }
    | { id: string; type: 'order'; prompt: string; items: string[]; explanation: string; context?: string }
    | { id: string; type: 'match'; prompt: string; pairs: { left: string; right: string }[]; explanation: string; context?: string };

export type Quiz = { slug: string; title: string; description?: string | null; questions: QuizQuestion[] };

export type LayerInfo = {
    slug: string;
    model: 'osi' | 'tcpip';
    number: number;
    name: string;
    english: string;
    role: string;
    problem: string;
    examples: string[];
    devices: string[];
    pdu: string | null;
    neighbors: string;
    note: string | null;
    protocols: { slug: string; acronym: string }[];
    maps_to: number[];
};

export type LessonSummary = {
    slug: string;
    title: string;
    track: string;
    objective: string;
    duration: number;
    kind: 'scenario' | 'page';
    href: string;
    featured: boolean;
    scenario_key?: string | null;
    is_lab?: boolean;
};

export type LabStatus = { completed: boolean; progress: number } | null;
