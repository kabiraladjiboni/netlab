import { parseIPv4, prefixToMask } from '@/lib/cidr';
import type { CapturePacket, FieldValue } from './types';

/**
 * Mini-moteur de filtres d'affichage, compatible avec un sous-ensemble de la
 * syntaxe Wireshark : protocoles (« dns »), comparaisons (==, !=, >, <, >=, <=,
 * contains, et leurs équivalents eq, ne, gt…), opérateurs logiques (&&, ||, !,
 * and, or, not), parenthèses, adresses IPv4 avec préfixe CIDR.
 */

export const PROTOCOLS = ['eth', 'arp', 'ip', 'icmp', 'tcp', 'udp', 'dns', 'tls', 'http', 'dhcp', 'quic', 'ipv6'] as const;

export const KNOWN_FIELDS = [
    'frame.number', 'frame.len',
    'eth.src', 'eth.dst', 'eth.addr',
    'arp.opcode', 'arp.src.proto_ipv4', 'arp.dst.proto_ipv4', 'arp.src.hw_mac',
    'ip.src', 'ip.dst', 'ip.addr', 'ip.ttl', 'ip.proto', 'ip.len',
    'icmp.type', 'icmp.code',
    'tcp.srcport', 'tcp.dstport', 'tcp.port', 'tcp.seq', 'tcp.ack', 'tcp.len', 'tcp.window_size_value', 'tcp.stream',
    'tcp.flags.syn', 'tcp.flags.ack', 'tcp.flags.fin', 'tcp.flags.reset', 'tcp.flags.push', 'tcp.analysis.retransmission',
    'udp.srcport', 'udp.dstport', 'udp.port', 'udp.length',
    'dns.qry.name', 'dns.qry.type', 'dns.flags.response', 'dns.flags.rcode', 'dns.a', 'dns.id',
    'tls.handshake.type', 'tls.handshake.extensions_server_name', 'tls.record.content_type',
    'http.request.method', 'http.request.uri', 'http.host', 'http.response.code',
    'dhcp.option.dhcp', 'dhcp.ip.your',
] as const;

type Op = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';

type Node =
    | { kind: 'and' | 'or'; left: Node; right: Node }
    | { kind: 'not'; node: Node }
    | { kind: 'exists'; field: string }
    | { kind: 'compare'; field: string; op: Op; value: string };

export type FilterResult = { ok: true; match: (packet: CapturePacket) => boolean } | { ok: false; error: string };

const OP_WORDS: Record<string, Op> = { eq: '==', ne: '!=', gt: '>', lt: '<', ge: '>=', le: '<=', contains: 'contains', '==': '==', '!=': '!=', '>': '>', '<': '<', '>=': '>=', '<=': '<=' };

function tokenize(input: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < input.length) {
        const char = input[i];
        if (/\s/.test(char)) {
            i += 1;
            continue;
        }
        const two = input.slice(i, i + 2);
        if (['&&', '||', '==', '!=', '>=', '<='].includes(two)) {
            tokens.push(two);
            i += 2;
            continue;
        }
        if ('()!<>'.includes(char)) {
            tokens.push(char);
            i += 1;
            continue;
        }
        if (char === '"') {
            const end = input.indexOf('"', i + 1);
            if (end === -1) throw new Error('Guillemet fermant manquant.');
            tokens.push(input.slice(i, end + 1));
            i = end + 1;
            continue;
        }
        const match = input.slice(i).match(/^[A-Za-z0-9_.:/-]+/);
        if (!match) throw new Error(`Caractère inattendu : « ${char} »`);
        tokens.push(match[0]);
        i += match[0].length;
    }
    return tokens;
}

function parse(tokens: string[]): Node {
    let position = 0;
    const peek = () => tokens[position];
    const next = () => tokens[position++];

    const parseOr = (): Node => {
        let left = parseAnd();
        while (peek() === '||' || peek()?.toLowerCase() === 'or') {
            next();
            left = { kind: 'or', left, right: parseAnd() };
        }
        return left;
    };
    const parseAnd = (): Node => {
        let left = parseNot();
        while (peek() === '&&' || peek()?.toLowerCase() === 'and') {
            next();
            left = { kind: 'and', left, right: parseNot() };
        }
        return left;
    };
    const parseNot = (): Node => {
        if (peek() === '!' || peek()?.toLowerCase() === 'not') {
            next();
            return { kind: 'not', node: parseNot() };
        }
        return parsePrimary();
    };
    const parsePrimary = (): Node => {
        const token = next();
        if (token === undefined) throw new Error('Expression incomplète.');
        if (token === '(') {
            const node = parseOr();
            if (next() !== ')') throw new Error('Parenthèse fermante manquante.');
            return node;
        }
        const field = token.toLowerCase();
        if (!(PROTOCOLS as readonly string[]).includes(field) && !(KNOWN_FIELDS as readonly string[]).includes(field)) {
            throw new Error(`Champ ou protocole « ${token} » non pris en charge dans cette version pédagogique.`);
        }
        const opToken = peek();
        const op = opToken ? OP_WORDS[opToken.toLowerCase()] : undefined;
        if (!op) return { kind: 'exists', field };
        next();
        const value = next();
        if (value === undefined || value === ')' || value === '(') throw new Error(`Valeur manquante après « ${opToken} ».`);
        return { kind: 'compare', field, op, value: value.startsWith('"') ? value.slice(1, -1) : value };
    };

    const tree = parseOr();
    if (position < tokens.length) throw new Error(`Élément inattendu : « ${tokens[position]} ».`);
    return tree;
}

function toNumber(value: FieldValue | string): number | null {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (/^0x[0-9a-f]+$/i.test(value)) return parseInt(value, 16);
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    return null;
}

function compareOne(actual: FieldValue, op: Op, expected: string): boolean {
    if (op === 'contains') return String(actual).includes(expected);
    // Adresse IPv4 avec préfixe : ip.addr == 192.168.1.0/24
    if (typeof actual === 'string' && expected.includes('/') && parseIPv4(actual) !== null) {
        const [base, bits] = expected.split('/');
        const network = parseIPv4(base);
        const prefix = Number(bits);
        if (network === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
        const mask = prefixToMask(prefix);
        const inside = ((parseIPv4(actual)! & mask) >>> 0) === ((network & mask) >>> 0);
        return op === '==' ? inside : op === '!=' ? !inside : false;
    }
    const a = toNumber(actual);
    const b = toNumber(expected);
    if (a !== null && b !== null) {
        switch (op) {
            case '==':
                return a === b;
            case '!=':
                return a !== b;
            case '>':
                return a > b;
            case '<':
                return a < b;
            case '>=':
                return a >= b;
            case '<=':
                return a <= b;
        }
    }
    const left = String(actual).toLowerCase();
    const right = expected.toLowerCase();
    if (op === '==') return left === right;
    if (op === '!=') return left !== right;
    return false;
}

function evaluate(node: Node, packet: CapturePacket): boolean {
    switch (node.kind) {
        case 'and':
            return evaluate(node.left, packet) && evaluate(node.right, packet);
        case 'or':
            return evaluate(node.left, packet) || evaluate(node.right, packet);
        case 'not':
            return !evaluate(node.node, packet);
        case 'exists':
            return packet.protocols.includes(node.field) || (packet.fields[node.field]?.length ?? 0) > 0;
        case 'compare': {
            const values = packet.fields[node.field] ?? [];
            if (node.op === '!=') {
                // Depuis Wireshark 3.6, « a != b » équivaut à « !(a == b) ».
                return values.length > 0 && !values.some((value) => compareOne(value, '==', node.value));
            }
            return values.some((value) => compareOne(value, node.op, node.value));
        }
    }
}

export function compileFilter(input: string): FilterResult {
    const text = input.trim();
    if (!text) return { ok: true, match: () => true };
    try {
        const tree = parse(tokenize(text));
        return { ok: true, match: (packet) => evaluate(tree, packet) };
    } catch (error) {
        return { ok: false, error: (error as Error).message };
    }
}
