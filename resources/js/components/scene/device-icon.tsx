import type { NodeKind } from '@/engine/types';

/**
 * Illustrations vectorielles des équipements, dessinées sur mesure.
 * Chaque icône est centrée sur (0, 0) dans une boîte de ~72 × 72 unités,
 * ce qui permet de l'animer et de la positionner individuellement dans la scène.
 */

const stroke = 'var(--device-stroke)';
const body = 'var(--device-body, var(--device-body))';
const bodyLight = 'var(--device-body-light, var(--device-body-light))';
const glow = 'var(--device-glow)';

function Leds({ x, y, count = 3, gap = 7 }: { x: number; y: number; count?: number; gap?: number }) {
    return (
        <g>
            {Array.from({ length: count }, (_, i) => (
                <circle key={i} cx={x + i * gap} cy={y} r={1.8} fill={i === 0 ? 'var(--color-ok)' : stroke} className="device-led" />
            ))}
        </g>
    );
}

export function DeviceIcon({ kind }: { kind: NodeKind }) {
    switch (kind) {
        case 'laptop':
            return (
                <g>
                    <rect x={-26} y={-24} width={52} height={34} rx={4} fill={body} stroke={stroke} strokeWidth={2} />
                    <rect x={-21} y={-19} width={42} height={24} rx={2} fill={glow} />
                    <path d="M-16 -10 h18 M-16 -4 h26 M-16 2 h12" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
                    <path d="M-34 14 h68 l-6 8 h-56 z" fill={bodyLight} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
                </g>
            );
        case 'desktop':
            return (
                <g>
                    <rect x={-28} y={-26} width={56} height={38} rx={4} fill={body} stroke={stroke} strokeWidth={2} />
                    <rect x={-23} y={-21} width={46} height={28} rx={2} fill={glow} />
                    <path d="M-6 12 v8 M6 12 v8 M-16 22 h32" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />
                </g>
            );
        case 'phone':
            return (
                <g>
                    <rect x={-15} y={-28} width={30} height={56} rx={6} fill={body} stroke={stroke} strokeWidth={2} />
                    <rect x={-11} y={-21} width={22} height={38} rx={2} fill={glow} />
                    <path d="M-4 -24.5 h8" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
                    <circle cx={0} cy={22} r={2.2} fill={stroke} />
                </g>
            );
        case 'box':
            return (
                <g>
                    <path d="M-20 -14 l-6 -14 M20 -14 l6 -14" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />
                    <rect x={-32} y={-14} width={64} height={30} rx={8} fill={body} stroke={stroke} strokeWidth={2} />
                    <rect x={-26} y={-8} width={52} height={4} rx={2} fill={glow} />
                    <Leds x={-22} y={7} count={4} gap={8} />
                    <path d="M-30 20 h60" stroke={stroke} strokeOpacity={0.4} strokeWidth={2} />
                </g>
            );
        case 'router':
            return (
                <g>
                    <ellipse cx={0} cy={8} rx={30} ry={11} fill={bodyLight} stroke={stroke} strokeWidth={2} />
                    <rect x={-30} y={-10} width={60} height={18} fill={bodyLight} />
                    <path d="M-30 -10 v18 M30 -10 v18" stroke={stroke} strokeWidth={2} />
                    <ellipse cx={0} cy={-10} rx={30} ry={11} fill={body} stroke={stroke} strokeWidth={2} />
                    <g stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <path d="M-15 -10 h-7 m3 -3 l-3 3 l3 3" />
                        <path d="M15 -10 h7 m-3 -3 l3 3 l-3 3" />
                        <path d="M-5 -15 l-3 -3 m0 0 h4 m-4 0 v4" />
                        <path d="M5 -5 l3 3 m0 0 h-4 m4 0 v-4" />
                    </g>
                </g>
            );
        case 'switch':
            return (
                <g>
                    <rect x={-34} y={-14} width={68} height={28} rx={5} fill={body} stroke={stroke} strokeWidth={2} />
                    {Array.from({ length: 8 }, (_, i) => (
                        <rect key={i} x={-28 + i * 7} y={-1} width={5} height={8} rx={1} fill={glow} stroke={stroke} strokeWidth={0.8} />
                    ))}
                    <path d="M-18 -7 h36 m-4 -3 l4 3 l-4 3 M18 -7" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" fill="none" />
                </g>
            );
        case 'server':
        case 'dns':
        case 'loadbalancer':
            return (
                <g>
                    {[0, 1, 2].map((i) => (
                        <g key={i} transform={`translate(0 ${-24 + i * 17})`}>
                            <rect x={-24} y={0} width={48} height={14} rx={3} fill={i === 1 ? bodyLight : body} stroke={stroke} strokeWidth={2} />
                            <Leds x={-17} y={7} count={2} gap={6} />
                            <path d="M4 7 h13" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
                        </g>
                    ))}
                    {kind === 'dns' && (
                        <g transform="translate(20 -26)">
                            <rect x={-12} y={-8} width={26} height={14} rx={7} fill="var(--color-violet)" />
                            <text x={1} y={2.5} textAnchor="middle" fontSize={8} fontWeight={700} fill="var(--color-on-accent)" fontFamily="var(--font-mono)">
                                DNS
                            </text>
                        </g>
                    )}
                    {kind === 'loadbalancer' && (
                        <path d="M-34 0 h8 M26 -17 h8 M26 0 h8 M26 17 h8" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
                    )}
                </g>
            );
        case 'firewall':
            return (
                <g>
                    <rect x={-28} y={-24} width={56} height={46} rx={4} fill={body} stroke="var(--color-warn)" strokeWidth={2} />
                    <g stroke="var(--color-warn)" strokeWidth={1.6} opacity={0.85}>
                        <path d="M-28 -12 h56 M-28 0 h56 M-28 11 h56" />
                        <path d="M-10 -24 v12 M12 -24 v12 M0 -12 v12 M-18 -12 v12 M20 -12 v12 M-10 0 v11 M12 0 v11 M0 11 v11 M-18 11 v11 M20 11 v11" />
                    </g>
                </g>
            );
        case 'ap':
            return (
                <g>
                    <g fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" className="device-waves">
                        <path d="M-12 -14 a17 17 0 0 1 24 0" />
                        <path d="M-20 -22 a28 28 0 0 1 40 0" opacity={0.6} />
                    </g>
                    <path d="M-28 4 a28 12 0 0 1 56 0 v6 a28 12 0 0 1 -56 0 z" fill={body} stroke={stroke} strokeWidth={2} />
                    <circle cx={0} cy={6} r={2.5} fill="var(--color-ok)" />
                </g>
            );
        case 'cloud':
            return (
                <g>
                    <path
                        d="M-22 16 a14 14 0 0 1 -2 -28 a18 18 0 0 1 33 -6 a14 14 0 0 1 17 15 a10 10 0 0 1 -4 19 z"
                        fill={body}
                        stroke={stroke}
                        strokeWidth={2}
                        strokeLinejoin="round"
                    />
                    <path d="M-12 4 h22 M-6 -4 h18" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
                </g>
            );
        case 'ont':
            return (
                <g>
                    <rect x={-24} y={-12} width={48} height={26} rx={5} fill={body} stroke={stroke} strokeWidth={2} />
                    <Leds x={-15} y={1} count={3} gap={7} />
                    <path d="M24 0 c10 0 10 -14 20 -14" stroke="var(--color-warn)" strokeWidth={2} fill="none" />
                </g>
            );
        case 'tower':
            return (
                <g>
                    <path d="M-14 26 L0 -18 L14 26 M-9 10 h18 M-5 -2 h10 M-11 18 l20 -16 M11 18 l-20 -16" stroke={stroke} strokeWidth={2} fill="none" strokeLinejoin="round" />
                    <circle cx={0} cy={-20} r={3} fill={stroke} />
                    <g fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" className="device-waves">
                        <path d="M-10 -28 a12 12 0 0 0 0 16" />
                        <path d="M10 -28 a12 12 0 0 1 0 16" />
                    </g>
                </g>
            );
        case 'iot':
            return (
                <g>
                    <rect x={-18} y={-18} width={36} height={36} rx={8} fill={body} stroke={stroke} strokeWidth={2} />
                    <circle cx={0} cy={0} r={8} fill={glow} stroke={stroke} strokeWidth={1.6} />
                    <path d="M-6 -24 v6 M6 -24 v6 M-6 18 v6 M6 18 v6" stroke={stroke} strokeWidth={1.6} />
                </g>
            );
        default:
            return <circle r={22} fill={body} stroke={stroke} strokeWidth={2} />;
    }
}
