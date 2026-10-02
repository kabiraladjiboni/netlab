import type { CapturePacket, FieldValue, RowColor, TreeField, TreeLayer } from './types';

/**
 * Analyse BASIQUE de fichiers PCAP et PCAPNG, entièrement dans le navigateur :
 * le fichier n'est jamais envoyé au serveur. Seuls les en-têtes courants sont
 * décodés (Ethernet, 802.1Q, ARP, IPv4, IPv6, ICMP, TCP, UDP) ainsi que
 * quelques informations applicatives (DNS, SNI TLS, HTTP en clair, DHCP).
 * Ce n'est pas un remplaçant de Wireshark.
 */

export const PCAP_LIMITS = { maxBytes: 10 * 1024 * 1024, maxPackets: 5000 };

export type PcapResult = {
    format: 'pcap' | 'pcapng';
    linkType: number;
    packets: CapturePacket[];
    total: number;
    truncated: boolean;
    warnings: string[];
};

export class PcapError extends Error {}

type RawPacket = { ts: number; data: Uint8Array; originalLength: number; linkType: number };

const LINK_TYPES: Record<number, string> = { 0: 'Loopback BSD', 1: 'Ethernet', 101: 'IP brut', 113: 'Linux « cooked » (SLL)', 228: 'IPv4 brut', 229: 'IPv6 brut', 276: 'Linux SLL2' };

/* ------------------------------------------------------------------ */
/* Lecture des conteneurs                                               */
/* ------------------------------------------------------------------ */

function readPcap(view: DataView): { linkType: number; raw: RawPacket[]; truncated: boolean; total: number } {
    const magic = view.getUint32(0, false);
    let little: boolean;
    let nano = false;
    if (magic === 0xa1b2c3d4) little = false;
    else if (magic === 0xd4c3b2a1) little = true;
    else if (magic === 0xa1b23c4d) {
        little = false;
        nano = true;
    } else if (magic === 0x4d3cb2a1) {
        little = true;
        nano = true;
    } else throw new PcapError('Format non reconnu.');
    if (view.byteLength < 24) throw new PcapError('En-tête PCAP incomplet.');
    const linkType = view.getUint32(20, little) & 0x0fffffff;
    const raw: RawPacket[] = [];
    let offset = 24;
    let total = 0;
    while (offset + 16 <= view.byteLength) {
        const sec = view.getUint32(offset, little);
        const frac = view.getUint32(offset + 4, little);
        const included = view.getUint32(offset + 8, little);
        const original = view.getUint32(offset + 12, little);
        offset += 16;
        if (included > 262144 || offset + included > view.byteLength) break;
        total += 1;
        if (raw.length < PCAP_LIMITS.maxPackets) {
            raw.push({ ts: sec + frac / (nano ? 1e9 : 1e6), data: new Uint8Array(view.buffer, view.byteOffset + offset, included), originalLength: original, linkType });
        }
        offset += included;
    }
    return { linkType, raw, truncated: total > raw.length, total };
}

function readPcapng(view: DataView): { linkType: number; raw: RawPacket[]; truncated: boolean; total: number } {
    let offset = 0;
    let little = true;
    const interfaces: { linkType: number; resolution: number }[] = [];
    const raw: RawPacket[] = [];
    let total = 0;
    while (offset + 12 <= view.byteLength) {
        let type = view.getUint32(offset, little);
        if (type === 0x0a0d0d0a) {
            const bom = view.getUint32(offset + 8, true);
            little = bom === 0x1a2b3c4d;
            if (!little && view.getUint32(offset + 8, false) !== 0x1a2b3c4d) throw new PcapError('Ordre des octets PCAPNG invalide.');
            type = 0x0a0d0d0a;
            interfaces.length = 0;
        }
        const length = view.getUint32(offset + 4, little);
        if (length < 12 || offset + length > view.byteLength) break;
        const body = offset + 8;
        if (type === 1) {
            // Interface Description Block
            const linkType = view.getUint16(body, little);
            let resolution = 1e6;
            let opt = body + 8;
            while (opt + 4 <= offset + length - 4) {
                const code = view.getUint16(opt, little);
                const optLength = view.getUint16(opt + 2, little);
                if (code === 0) break;
                if (code === 9 && optLength >= 1) {
                    const value = view.getUint8(opt + 4);
                    resolution = value & 0x80 ? 2 ** (value & 0x7f) : 10 ** value;
                }
                opt += 4 + Math.ceil(optLength / 4) * 4;
            }
            interfaces.push({ linkType, resolution });
        } else if (type === 6) {
            // Enhanced Packet Block
            const iface = interfaces[view.getUint32(body, little)];
            const high = view.getUint32(body + 4, little);
            const low = view.getUint32(body + 8, little);
            const captured = view.getUint32(body + 12, little);
            const original = view.getUint32(body + 16, little);
            if (iface && body + 20 + captured <= offset + length) {
                total += 1;
                if (raw.length < PCAP_LIMITS.maxPackets) {
                    raw.push({ ts: (high * 2 ** 32 + low) / iface.resolution, data: new Uint8Array(view.buffer, view.byteOffset + body + 20, captured), originalLength: original, linkType: iface.linkType });
                }
            }
        } else if (type === 3) {
            // Simple Packet Block (sans horodatage)
            const iface = interfaces[0];
            const original = view.getUint32(body, little);
            const captured = Math.min(original, length - 16);
            if (iface) {
                total += 1;
                if (raw.length < PCAP_LIMITS.maxPackets) raw.push({ ts: 0, data: new Uint8Array(view.buffer, view.byteOffset + body + 4, captured), originalLength: original, linkType: iface.linkType });
            }
        }
        offset += length;
    }
    return { linkType: interfaces[0]?.linkType ?? -1, raw, truncated: total > raw.length, total };
}

/* ------------------------------------------------------------------ */
/* Décodage des protocoles                                              */
/* ------------------------------------------------------------------ */

const hex = (value: number, width = 4) => `0x${value.toString(16).padStart(width, '0')}`;
const mac = (d: Uint8Array, o: number) => Array.from(d.slice(o, o + 6), (b) => b.toString(16).padStart(2, '0')).join(':');
const ipv4 = (d: Uint8Array, o: number) => `${d[o]}.${d[o + 1]}.${d[o + 2]}.${d[o + 3]}`;
function ipv6(d: Uint8Array, o: number): string {
    const groups: string[] = [];
    for (let i = 0; i < 16; i += 2) groups.push(((d[o + i] << 8) | d[o + i + 1]).toString(16));
    return groups.join(':').replace(/(^|:)0(:0)+(:|$)/, '::').replace(/:{3,}/, '::');
}
const u16 = (d: Uint8Array, o: number) => (d[o] << 8) | d[o + 1];
const u32 = (d: Uint8Array, o: number) => ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;

function dnsName(d: Uint8Array, start: number, base: number): string {
    const labels: string[] = [];
    let offset = start;
    let jumps = 0;
    while (offset < d.length && jumps < 20) {
        const length = d[offset];
        if (length === 0) break;
        if ((length & 0xc0) === 0xc0) {
            offset = base + (((length & 0x3f) << 8) | d[offset + 1]);
            jumps += 1;
            continue;
        }
        labels.push(String.fromCharCode(...d.slice(offset + 1, offset + 1 + length)));
        offset += length + 1;
    }
    return labels.join('.');
}

function tlsSni(d: Uint8Array, o: number): string | null {
    // Enregistrement TLS Handshake (22) contenant un ClientHello (1).
    if (d[o] !== 22 || d[o + 5] !== 1) return null;
    let p = o + 9 + 2 + 32; // en-tête + version + aléa
    if (p >= d.length) return null;
    p += 1 + d[p]; // session id
    p += 2 + u16(d, p); // suites
    p += 1 + d[p]; // compression
    const end = p + 2 + u16(d, p);
    p += 2;
    while (p + 4 <= Math.min(end, d.length)) {
        const type = u16(d, p);
        const length = u16(d, p + 2);
        if (type === 0 && p + 9 <= d.length) {
            const nameLength = u16(d, p + 7);
            return String.fromCharCode(...d.slice(p + 9, p + 9 + nameLength));
        }
        p += 4 + length;
    }
    return null;
}

type FlowState = { isn: Map<string, number>; seen: Map<string, Set<string>> };

function dissect(rawPacket: RawPacket, no: number, time: number, flows: FlowState): CapturePacket {
    const d = rawPacket.data;
    const fields: Record<string, FieldValue[]> = {};
    const add = (key: string, ...values: FieldValue[]) => (fields[key] = [...(fields[key] ?? []), ...values]);
    const protocols: string[] = [];
    const tree: TreeLayer[] = [];
    let src = '';
    let dst = '';
    let protocol = LINK_TYPES[rawPacket.linkType] ?? `Lien ${rawPacket.linkType}`;
    let info = '';
    let color: RowColor = 'other';
    let encrypted = false;

    add('frame.number', no);
    add('frame.len', rawPacket.originalLength);
    tree.push({
        title: `Frame ${no} : ${rawPacket.originalLength} octets sur le câble, ${d.length} octets capturés`,
        kind: 'frame',
        fields: [{ label: `Temps relatif : ${time.toFixed(6)} s` }, { label: `Type de lien : ${LINK_TYPES[rawPacket.linkType] ?? rawPacket.linkType}` }],
    });

    let etherType = -1;
    let offset = 0;
    if (rawPacket.linkType === 1 && d.length >= 14) {
        protocols.push('eth');
        const dstMac = mac(d, 0);
        const srcMac = mac(d, 6);
        add('eth.src', srcMac);
        add('eth.dst', dstMac);
        add('eth.addr', srcMac, dstMac);
        etherType = u16(d, 12);
        offset = 14;
        const ethFields: TreeField[] = [{ label: `Destination : ${dstMac}` }, { label: `Source : ${srcMac}` }];
        if (etherType === 0x8100 && d.length >= 18) {
            ethFields.push({ label: `802.1Q : VLAN ${u16(d, 14) & 0x0fff}` });
            etherType = u16(d, 16);
            offset = 18;
        }
        ethFields.push({ label: `Type : ${hex(etherType)}` });
        tree.push({ title: `Ethernet II, Src: ${srcMac}, Dst: ${dstMac}`, kind: 'link', fields: ethFields });
        src = srcMac;
        dst = dstMac === 'ff:ff:ff:ff:ff:ff' ? 'Broadcast' : dstMac;
    } else if (rawPacket.linkType === 113 && d.length >= 16) {
        etherType = u16(d, 14);
        offset = 16;
    } else if (rawPacket.linkType === 276 && d.length >= 20) {
        etherType = u16(d, 0);
        offset = 20;
    } else if ([101, 228, 229].includes(rawPacket.linkType) && d.length > 0) {
        etherType = d[0] >> 4 === 6 ? 0x86dd : 0x0800;
    } else if (rawPacket.linkType === 0 && d.length >= 4) {
        const family = d[0] || d[3];
        etherType = family === 2 ? 0x0800 : 0x86dd;
        offset = 4;
    }

    let l4: { proto: number; offset: number; end: number } | null = null;

    if (etherType === 0x0806 && d.length >= offset + 28) {
        protocols.push('arp');
        const op = u16(d, offset + 6);
        const senderIp = ipv4(d, offset + 14);
        const targetIp = ipv4(d, offset + 24);
        add('arp.opcode', op);
        add('arp.src.proto_ipv4', senderIp);
        add('arp.dst.proto_ipv4', targetIp);
        tree.push({ title: `Address Resolution Protocol (${op === 1 ? 'request' : 'reply'})`, kind: 'link', fields: [{ label: `Opcode : ${op}` }, { label: `Sender IP : ${senderIp}` }, { label: `Target IP : ${targetIp}` }] });
        protocol = 'ARP';
        color = 'arp';
        info = op === 1 ? `Who has ${targetIp}? Tell ${senderIp}` : `${senderIp} is at ${mac(d, offset + 8)}`;
    } else if (etherType === 0x0800 && d.length >= offset + 20) {
        protocols.push('ip');
        const ihl = (d[offset] & 0x0f) * 4;
        const totalLength = u16(d, offset + 2);
        const ttl = d[offset + 8];
        const proto = d[offset + 9];
        src = ipv4(d, offset + 12);
        dst = ipv4(d, offset + 16);
        add('ip.src', src);
        add('ip.dst', dst);
        add('ip.addr', src, dst);
        add('ip.ttl', ttl);
        add('ip.proto', proto);
        add('ip.len', totalLength);
        tree.push({ title: `Internet Protocol Version 4, Src: ${src}, Dst: ${dst}`, kind: 'network', fields: [{ label: `Total Length : ${totalLength}` }, { label: `Time to Live : ${ttl}`, filter: 'ip.ttl' }, { label: `Protocol : ${proto}` }] });
        protocol = 'IPv4';
        l4 = { proto, offset: offset + ihl, end: Math.min(d.length, offset + totalLength) };
    } else if (etherType === 0x86dd && d.length >= offset + 40) {
        protocols.push('ipv6');
        let next = d[offset + 6];
        const hopLimit = d[offset + 7];
        src = ipv6(d, offset + 8);
        dst = ipv6(d, offset + 24);
        let p = offset + 40;
        let guard = 0;
        while ([0, 43, 44, 60].includes(next) && p + 8 <= d.length && guard < 8) {
            const header = next;
            next = d[p];
            p += header === 44 ? 8 : (d[p + 1] + 1) * 8;
            guard += 1;
        }
        tree.push({ title: `Internet Protocol Version 6, Src: ${src}, Dst: ${dst}`, kind: 'network', fields: [{ label: `Hop Limit : ${hopLimit}` }, { label: `Next Header : ${next}` }] });
        protocol = 'IPv6';
        l4 = { proto: next, offset: p, end: d.length };
    }

    if (l4) {
        const { proto, offset: o, end } = l4;
        if ((proto === 1 || proto === 58) && end >= o + 4) {
            protocols.push(proto === 1 ? 'icmp' : 'icmpv6');
            add('icmp.type', d[o]);
            add('icmp.code', d[o + 1]);
            tree.push({ title: proto === 1 ? 'Internet Control Message Protocol' : 'Internet Control Message Protocol v6', kind: 'network', fields: [{ label: `Type : ${d[o]}`, filter: 'icmp.type' }, { label: `Code : ${d[o + 1]}` }] });
            protocol = proto === 1 ? 'ICMP' : 'ICMPv6';
            color = 'icmp';
            const names: Record<number, string> = proto === 1 ? { 0: 'Echo (ping) reply', 3: 'Destination unreachable', 8: 'Echo (ping) request', 11: 'Time-to-live exceeded' } : { 1: 'Destination unreachable', 2: 'Packet too big', 3: 'Time exceeded', 128: 'Echo request', 129: 'Echo reply', 133: 'Router Solicitation', 134: 'Router Advertisement', 135: 'Neighbor Solicitation', 136: 'Neighbor Advertisement' };
            info = names[d[o]] ?? `Type ${d[o]}`;
        } else if (proto === 6 && end >= o + 20) {
            protocols.push('tcp');
            const sport = u16(d, o);
            const dport = u16(d, o + 2);
            const seqRaw = u32(d, o + 4);
            const ackRaw = u32(d, o + 8);
            const headerLength = (d[o + 12] >> 4) * 4;
            const flags = d[o + 13];
            const window = u16(d, o + 14);
            const payload = Math.max(0, end - o - headerLength);
            const flagNames = [flags & 2 ? 'SYN' : '', flags & 1 ? 'FIN' : '', flags & 4 ? 'RST' : '', flags & 8 ? 'PSH' : '', flags & 16 ? 'ACK' : ''].filter(Boolean);
            const forward = `${src}:${sport}>${dst}:${dport}`;
            const reverse = `${dst}:${dport}>${src}:${sport}`;
            if (flags & 2 || !flows.isn.has(forward)) flows.isn.set(forward, flags & 2 ? seqRaw : (flows.isn.get(forward) ?? seqRaw));
            const isn = flows.isn.get(forward)!;
            const seq = (seqRaw - isn) >>> 0;
            const peerIsn = flows.isn.get(reverse);
            const ack = flags & 16 && peerIsn !== undefined ? (ackRaw - peerIsn) >>> 0 : ackRaw;
            const key = `${seqRaw}:${payload}:${flags & 3}`;
            const seen = flows.seen.get(forward) ?? new Set<string>();
            const retransmission = (payload > 0 || flags & 3) && seen.has(key);
            seen.add(key);
            flows.seen.set(forward, seen);
            add('tcp.srcport', sport);
            add('tcp.dstport', dport);
            add('tcp.port', sport, dport);
            add('tcp.seq', seq);
            add('tcp.ack', ack);
            add('tcp.len', payload);
            add('tcp.window_size_value', window);
            add('tcp.flags.syn', flags & 2 ? 1 : 0);
            add('tcp.flags.ack', flags & 16 ? 1 : 0);
            add('tcp.flags.fin', flags & 1 ? 1 : 0);
            add('tcp.flags.reset', flags & 4 ? 1 : 0);
            add('tcp.flags.push', flags & 8 ? 1 : 0);
            if (retransmission) add('tcp.analysis.retransmission', true);
            tree.push({
                title: `Transmission Control Protocol, Src Port: ${sport}, Dst Port: ${dport}, Seq: ${seq}, Len: ${payload}`,
                kind: 'transport',
                fields: [
                    { label: `Sequence Number : ${seq} (relatif) — brut ${seqRaw}` },
                    { label: `Acknowledgment Number : ${ack}` },
                    { label: `Flags : ${hex(flags, 3)} (${flagNames.join(', ')})`, filter: 'tcp.flags' },
                    { label: `Window : ${window}` },
                    ...(retransmission ? [{ label: '[Analyse : retransmission probable]', filter: 'tcp.analysis.retransmission' }] : []),
                ],
            });
            protocol = 'TCP';
            color = flags & 4 ? 'rst' : flags & 3 ? 'syn' : 'tcp';
            info = `${retransmission ? '[TCP Retransmission] ' : ''}${sport} → ${dport} [${flagNames.join(', ')}] Seq=${seq}${flags & 16 ? ` Ack=${ack}` : ''} Win=${window} Len=${payload}`;
            if (retransmission) color = 'bad';
            const data = o + headerLength;
            if (payload > 5 && (sport === 443 || dport === 443) && d[data] >= 20 && d[data] <= 23 && d[data + 1] === 3) {
                protocols.push('tls');
                const sni = tlsSni(d, data);
                encrypted = d[data] === 23;
                if (sni) add('tls.handshake.extensions_server_name', sni);
                add('tls.record.content_type', d[data]);
                if (d[data] === 22) add('tls.handshake.type', d[data + 5]);
                protocol = 'TLS';
                color = 'tls';
                info = sni ? `Client Hello (SNI=${sni})` : d[data] === 23 ? 'Application Data' : d[data] === 22 ? 'Handshake' : 'TLS';
                tree.push({ title: 'Transport Layer Security', kind: 'security', fields: [{ label: `Type d’enregistrement : ${d[data]}` }, ...(sni ? [{ label: `Server Name (SNI) : ${sni}` }] : [])] });
            } else if (payload > 4) {
                const head = String.fromCharCode(...d.slice(data, Math.min(data + 64, end)));
                const request = head.match(/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) (\S+) HTTP\/1\.[01]/);
                const response = head.match(/^HTTP\/1\.[01] (\d{3}) ?([^\r\n]*)/);
                if (request || response) {
                    protocols.push('http');
                    protocol = 'HTTP';
                    color = 'http';
                    if (request) {
                        add('http.request.method', request[1]);
                        add('http.request.uri', request[2]);
                        info = `${request[1]} ${request[2]} HTTP/1.1`;
                    } else if (response) {
                        add('http.response.code', Number(response[1]));
                        info = `HTTP/1.1 ${response[1]} ${response[2]}`;
                    }
                    tree.push({ title: 'Hypertext Transfer Protocol', kind: 'app', fields: [{ label: head.split('\r\n')[0] }] });
                }
            }
        } else if (proto === 17 && end >= o + 8) {
            protocols.push('udp');
            const sport = u16(d, o);
            const dport = u16(d, o + 2);
            const length = u16(d, o + 4);
            add('udp.srcport', sport);
            add('udp.dstport', dport);
            add('udp.port', sport, dport);
            add('udp.length', length);
            tree.push({ title: `User Datagram Protocol, Src Port: ${sport}, Dst Port: ${dport}`, kind: 'transport', fields: [{ label: `Length : ${length}` }] });
            protocol = 'UDP';
            color = 'udp';
            info = `${sport} → ${dport} Len=${Math.max(0, length - 8)}`;
            const data = o + 8;
            if ((sport === 53 || dport === 53 || sport === 5353 || dport === 5353) && end >= data + 12) {
                protocols.push('dns');
                const id = u16(d, data);
                const flags = u16(d, data + 2);
                const response = (flags & 0x8000) !== 0;
                const name = u16(d, data + 4) > 0 ? dnsName(d, data + 12, data) : '';
                add('dns.id', hex(id));
                add('dns.flags.response', response ? 1 : 0);
                add('dns.flags.rcode', flags & 0x0f);
                if (name) add('dns.qry.name', name);
                tree.push({ title: `Domain Name System (${response ? 'response' : 'query'})`, kind: 'app', fields: [{ label: `Transaction ID : ${hex(id)}` }, { label: `Flags : ${hex(flags)}` }, { label: `Query : ${name}` }] });
                protocol = sport === 5353 || dport === 5353 ? 'MDNS' : 'DNS';
                color = 'dns';
                info = `Standard query${response ? ' response' : ''} ${hex(id)} ${name}${response && (flags & 0x0f) === 3 ? ' (No such name)' : ''}`;
            } else if ((sport === 67 || sport === 68) && (dport === 67 || dport === 68) && end >= data + 240) {
                protocols.push('dhcp');
                let p = data + 240;
                let type = 0;
                while (p + 2 <= end && d[p] !== 255) {
                    if (d[p] === 0) {
                        p += 1;
                        continue;
                    }
                    if (d[p] === 53) type = d[p + 2];
                    p += 2 + d[p + 1];
                }
                const names: Record<number, string> = { 1: 'Discover', 2: 'Offer', 3: 'Request', 4: 'Decline', 5: 'ACK', 6: 'NAK', 7: 'Release', 8: 'Inform' };
                add('dhcp.option.dhcp', type);
                add('dhcp.ip.your', ipv4(d, data + 16));
                protocol = 'DHCP';
                color = 'dhcp';
                info = `DHCP ${names[type] ?? type} - Transaction ID ${hex(u32(d, data + 4), 8)}`;
                tree.push({ title: `Dynamic Host Configuration Protocol (${names[type] ?? type})`, kind: 'app', fields: [{ label: `Your (client) IP address : ${ipv4(d, data + 16)}` }] });
            } else if ((sport === 443 || dport === 443) && end > data && d[data] & 0x80) {
                protocols.push('quic');
                protocol = 'QUIC';
                color = 'quic';
                encrypted = true;
                info = 'QUIC (en-tête long : établissement de connexion)';
                tree.push({ title: 'QUIC IETF', kind: 'transport', fields: [{ label: 'Contenu chiffré' }] });
            }
        }
    }

    if (!info) info = protocol;
    return { no, time, src, dst, protocol, length: rawPacket.originalLength, info, color, tree, fields, protocols, encrypted };
}

export function parseCapture(buffer: ArrayBuffer): PcapResult {
    if (buffer.byteLength > PCAP_LIMITS.maxBytes) throw new PcapError('Fichier trop volumineux (10 Mo maximum).');
    if (buffer.byteLength < 24) throw new PcapError('Fichier trop petit pour être une capture.');
    const view = new DataView(buffer);
    const isNg = view.getUint32(0, true) === 0x0a0d0d0a;
    const { raw, truncated, total } = isNg ? readPcapng(view) : readPcap(view);
    if (raw.length === 0) throw new PcapError('Aucun paquet lisible dans ce fichier.');
    const warnings: string[] = [];
    const unsupported = new Set(raw.map((p) => p.linkType).filter((type) => !(type in LINK_TYPES)));
    if (unsupported.size > 0) warnings.push(`Type de lien non pris en charge (${[...unsupported].join(', ')}) : seuls les en-têtes connus sont affichés.`);
    if (truncated) warnings.push(`Seuls les ${PCAP_LIMITS.maxPackets} premiers paquets sont affichés (sur ${total}).`);
    const flows: FlowState = { isn: new Map(), seen: new Map() };
    const start = raw[0].ts;
    const packets = raw.map((packet, index) => {
        try {
            return dissect(packet, index + 1, Math.max(0, packet.ts - start), flows);
        } catch {
            return { no: index + 1, time: Math.max(0, packet.ts - start), src: '', dst: '', protocol: '?', length: packet.originalLength, info: 'Paquet malformé ou non décodé', color: 'bad' as const, tree: [], fields: {}, protocols: [] };
        }
    });
    return { format: isNg ? 'pcapng' : 'pcap', linkType: raw[0].linkType, packets, total, truncated, warnings };
}
