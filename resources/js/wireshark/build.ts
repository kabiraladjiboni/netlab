import type { CapturePacket, FieldValue, RowColor, TreeField, TreeLayer } from './types';

/**
 * Fabrique de paquets pédagogiques : à partir d'une description structurée,
 * on calcule les longueurs, la ligne « Info », l'arbre de détails et les
 * champs filtrables. Toutes les vues d'un même paquet restent donc cohérentes.
 */

type TcpFlag = 'SYN' | 'ACK' | 'PSH' | 'FIN' | 'RST';

export type PacketSpec = {
    time: number;
    eth: { src: string; dst: string };
    arp?: { op: 1 | 2; senderMac: string; senderIp: string; targetMac: string; targetIp: string };
    ip?: { src: string; dst: string; ttl: number; id?: string; df?: boolean };
    icmp?: { type: 0 | 3 | 8 | 11; code: number; id?: number; seq?: number; data: number };
    tcp?: {
        sport: number;
        dport: number;
        seq: number;
        ack: number;
        flags: TcpFlag[];
        win: number;
        options?: string;
        optionsLength?: number;
        payload: number;
        retransmission?: boolean;
        stream?: number;
    };
    udp?: { sport: number; dport: number; payload?: number };
    dns?: { id: string; response: boolean; name: string; type: 'A' | 'AAAA'; answer?: string; ttl?: number; nxdomain?: boolean };
    tls?: { records: string[]; sni?: string; alpn?: string };
    http?: { request?: { method: string; uri: string; host: string }; response?: { code: number; reason: string; type: string } };
    dhcp?: { type: 'Discover' | 'Offer' | 'Request' | 'ACK'; xid: string; yiaddr?: string; mask?: string; router?: string; dns?: string; lease?: number };
    beginner?: string;
    role?: string;
    lesson?: { href: string; label: string };
};

const f = (label: string, explain?: string, filter?: string, children?: TreeField[]): TreeField => ({ label, explain, filter, children });

const DHCP_TYPES = { Discover: 1, Offer: 2, Request: 3, ACK: 5 } as const;
const TLS_TYPES: Record<string, number> = { 'Client Hello': 1, 'Server Hello': 2 };

function dnsLength(spec: NonNullable<PacketSpec['dns']>): number {
    const qname = spec.name.split('.').reduce((sum, label) => sum + label.length + 1, 0) + 1;
    let length = 12 + qname + 4;
    if (spec.response && spec.answer) length += 16;
    if (spec.response && spec.nxdomain) length += 64; // section autorité SOA (taille illustrative)
    return length;
}

export function buildPacket(no: number, spec: PacketSpec): CapturePacket {
    const fields: Record<string, FieldValue[]> = {};
    const add = (key: string, ...values: FieldValue[]) => {
        fields[key] = [...(fields[key] ?? []), ...values];
    };
    const protocols = ['eth'];
    const tree: TreeLayer[] = [];

    // ---- Longueurs ----
    let l4Length = 0;
    let appPayload = 0;
    if (spec.dns) appPayload = dnsLength(spec.dns);
    if (spec.dhcp) appPayload = 300;
    if (spec.udp) l4Length = 8 + (spec.udp.payload ?? appPayload);
    if (spec.tcp) l4Length = 20 + (spec.tcp.optionsLength ?? 0) + spec.tcp.payload;
    if (spec.icmp) l4Length = 8 + spec.icmp.data;
    const ipLength = spec.ip ? 20 + l4Length : 0;
    const length = spec.arp ? 42 : 14 + ipLength;

    // ---- Trame ----
    add('frame.number', no);
    add('frame.len', length);
    tree.push({
        title: `Frame ${no} : ${length} octets sur le câble (${length * 8} bits), ${length} octets capturés`,
        kind: 'frame',
        fields: [
            f(`Temps relatif : ${spec.time.toFixed(6)} s`, 'Temps écoulé depuis le premier paquet de la capture.', 'frame.time_relative'),
            f(`Longueur de la trame : ${length} octets`, 'Taille de la trame telle que capturée (sans préambule ni FCS dans la plupart des captures).', 'frame.len'),
            f(`Protocoles dans la trame : ${['eth', 'ethertype', spec.arp ? 'arp' : 'ip', spec.tcp ? 'tcp' : spec.udp ? 'udp' : spec.icmp ? 'icmp' : '', spec.dns ? 'dns' : spec.tls ? 'tls' : spec.http ? 'http' : spec.dhcp ? 'dhcp' : ''].filter(Boolean).join(':')}`),
        ],
    });

    // ---- Ethernet ----
    const etherType = spec.arp ? 'ARP (0x0806)' : 'IPv4 (0x0800)';
    add('eth.src', spec.eth.src);
    add('eth.dst', spec.eth.dst);
    add('eth.addr', spec.eth.src, spec.eth.dst);
    tree.push({
        title: `Ethernet II, Src: ${spec.eth.src}, Dst: ${spec.eth.dst === 'ff:ff:ff:ff:ff:ff' ? 'Broadcast (ff:ff:ff:ff:ff:ff)' : spec.eth.dst}`,
        kind: 'link',
        fields: [
            f(`Destination : ${spec.eth.dst}`, 'Adresse MAC du prochain équipement sur le lien (ou diffusion).', 'eth.dst'),
            f(`Source : ${spec.eth.src}`, 'Adresse MAC de la carte qui a émis la trame.', 'eth.src'),
            f(`Type : ${etherType}`, 'Indique le protocole transporté dans la trame.', 'eth.type'),
        ],
    });

    let protocol = 'Ethernet';
    let info = '';
    let color: RowColor = 'other';

    // ---- ARP ----
    if (spec.arp) {
        protocols.push('arp');
        const a = spec.arp;
        add('arp.opcode', a.op);
        add('arp.src.proto_ipv4', a.senderIp);
        add('arp.dst.proto_ipv4', a.targetIp);
        add('arp.src.hw_mac', a.senderMac);
        tree.push({
            title: `Address Resolution Protocol (${a.op === 1 ? 'request' : 'reply'})`,
            kind: 'link',
            fields: [
                f('Hardware type : Ethernet (1)'),
                f('Protocol type : IPv4 (0x0800)'),
                f(`Opcode : ${a.op === 1 ? 'request (1)' : 'reply (2)'}`, '1 = requête, 2 = réponse.', 'arp.opcode'),
                f(`Sender MAC address : ${a.senderMac}`, 'Adresse MAC de l’émetteur.', 'arp.src.hw_mac'),
                f(`Sender IP address : ${a.senderIp}`, 'Adresse IP de l’émetteur.', 'arp.src.proto_ipv4'),
                f(`Target MAC address : ${a.targetMac}`, a.op === 1 ? 'Inconnue (tout à zéro) : c’est ce que l’on cherche.' : 'Adresse MAC du demandeur.', 'arp.dst.hw_mac'),
                f(`Target IP address : ${a.targetIp}`, 'Adresse IP recherchée (requête) ou du demandeur (réponse).', 'arp.dst.proto_ipv4'),
            ],
        });
        protocol = 'ARP';
        color = 'arp';
        info = a.op === 1 ? `Who has ${a.targetIp}? Tell ${a.senderIp}` : `${a.senderIp} is at ${a.senderMac}`;
    }

    // ---- IPv4 ----
    if (spec.ip) {
        protocols.push('ip');
        const ip = spec.ip;
        const proto = spec.tcp ? 6 : spec.udp ? 17 : 1;
        add('ip.src', ip.src);
        add('ip.dst', ip.dst);
        add('ip.addr', ip.src, ip.dst);
        add('ip.ttl', ip.ttl);
        add('ip.proto', proto);
        add('ip.len', ipLength);
        tree.push({
            title: `Internet Protocol Version 4, Src: ${ip.src}, Dst: ${ip.dst}`,
            kind: 'network',
            fields: [
                f('0100 .... = Version : 4'),
                f('.... 0101 = Header Length : 20 bytes (5)', 'En-tête IPv4 sans options.'),
                f(`Total Length : ${ipLength}`, 'Taille du paquet IP complet.', 'ip.len'),
                f(`Identification : ${ip.id ?? '0x1c46'}`, 'Identifiant utilisé en cas de fragmentation.', 'ip.id'),
                f(`Flags : ${ip.df === false ? '0x0' : '0x2, Don\'t fragment'}`, 'DF : le paquet ne doit pas être fragmenté.', 'ip.flags.df'),
                f(`Time to Live : ${ip.ttl}`, 'Diminué de 1 par chaque routeur ; il renseigne sur la distance (valeur initiale souvent 64 ou 128).', 'ip.ttl'),
                f(`Protocol : ${proto === 6 ? 'TCP (6)' : proto === 17 ? 'UDP (17)' : 'ICMP (1)'}`, 'Protocole transporté.', 'ip.proto'),
                f('Header Checksum : [validation désactivée]', 'Wireshark ne vérifie pas la somme de contrôle par défaut (souvent calculée par la carte réseau).'),
                f(`Source Address : ${ip.src}`, 'Adresse IP de l’émetteur à cet endroit du trajet.', 'ip.src'),
                f(`Destination Address : ${ip.dst}`, 'Adresse IP de la destination finale.', 'ip.dst'),
            ],
        });
    }

    // ---- ICMP ----
    if (spec.icmp) {
        protocols.push('icmp');
        const icmp = spec.icmp;
        add('icmp.type', icmp.type);
        add('icmp.code', icmp.code);
        const names: Record<number, string> = { 0: 'Echo (ping) reply', 3: 'Destination unreachable', 8: 'Echo (ping) request', 11: 'Time-to-live exceeded' };
        tree.push({
            title: 'Internet Control Message Protocol',
            kind: 'network',
            fields: [
                f(`Type : ${icmp.type} (${names[icmp.type]})`, '8 = demande d’écho, 0 = réponse, 3 = destination injoignable, 11 = TTL expiré.', 'icmp.type'),
                f(`Code : ${icmp.code}`, 'Précision sur le type.', 'icmp.code'),
                ...(icmp.id !== undefined ? [f(`Identifier : 0x${icmp.id.toString(16).padStart(4, '0')}`, 'Identifie le processus ping.'), f(`Sequence Number : ${icmp.seq}`, 'Numéro de l’essai.')] : []),
                f(`Data (${icmp.data} octets)`),
            ],
        });
        protocol = 'ICMP';
        color = 'icmp';
        info = icmp.type === 8 || icmp.type === 0 ? `${names[icmp.type]}  id=0x${(icmp.id ?? 1).toString(16).padStart(4, '0')}, seq=${icmp.seq}/${(icmp.seq ?? 0) * 256}, ttl=${spec.ip?.ttl}` : names[icmp.type];
    }

    // ---- UDP ----
    if (spec.udp) {
        protocols.push('udp');
        const u = spec.udp;
        add('udp.srcport', u.sport);
        add('udp.dstport', u.dport);
        add('udp.port', u.sport, u.dport);
        add('udp.length', l4Length);
        tree.push({
            title: `User Datagram Protocol, Src Port: ${u.sport}, Dst Port: ${u.dport}`,
            kind: 'transport',
            fields: [
                f(`Source Port : ${u.sport}`, 'Port de l’émetteur.', 'udp.srcport'),
                f(`Destination Port : ${u.dport}`, 'Port du service visé.', 'udp.dstport'),
                f(`Length : ${l4Length}`, 'En-tête (8 octets) + données.', 'udp.length'),
                f('Checksum : [non vérifiée]'),
            ],
        });
        protocol = 'UDP';
        color = 'udp';
        info = `${u.sport} → ${u.dport} Len=${l4Length - 8}`;
    }

    // ---- TCP ----
    if (spec.tcp) {
        protocols.push('tcp');
        const t = spec.tcp;
        const has = (flag: TcpFlag) => t.flags.includes(flag);
        const flagValue = (has('FIN') ? 1 : 0) | (has('SYN') ? 2 : 0) | (has('RST') ? 4 : 0) | (has('PSH') ? 8 : 0) | (has('ACK') ? 16 : 0);
        add('tcp.srcport', t.sport);
        add('tcp.dstport', t.dport);
        add('tcp.port', t.sport, t.dport);
        add('tcp.seq', t.seq);
        add('tcp.ack', t.ack);
        add('tcp.len', t.payload);
        add('tcp.window_size_value', t.win);
        add('tcp.stream', t.stream ?? 0);
        add('tcp.flags.syn', has('SYN') ? 1 : 0);
        add('tcp.flags.ack', has('ACK') ? 1 : 0);
        add('tcp.flags.fin', has('FIN') ? 1 : 0);
        add('tcp.flags.reset', has('RST') ? 1 : 0);
        add('tcp.flags.push', has('PSH') ? 1 : 0);
        if (t.retransmission) add('tcp.analysis.retransmission', true);
        const flagsText = t.flags.join(', ');
        tree.push({
            title: `Transmission Control Protocol, Src Port: ${t.sport}, Dst Port: ${t.dport}, Seq: ${t.seq}${has('ACK') ? `, Ack: ${t.ack}` : ''}, Len: ${t.payload}`,
            kind: 'transport',
            fields: [
                f(`Source Port : ${t.sport}`, 'Port de l’émetteur.', 'tcp.srcport'),
                f(`Destination Port : ${t.dport}`, 'Port du destinataire.', 'tcp.dstport'),
                f(`[Stream index : ${t.stream ?? 0}]`, 'Numéro de conversation attribué par Wireshark (pas un champ du paquet).', 'tcp.stream'),
                f(`Sequence Number : ${t.seq}    (relative sequence number)`, 'Numéro relatif calculé par Wireshark : le numéro brut est aléatoire.', 'tcp.seq'),
                ...(has('ACK') ? [f(`Acknowledgment Number : ${t.ack}    (relative ack number)`, 'Prochain octet attendu de l’autre côté.', 'tcp.ack')] : []),
                f(`Header Length : ${20 + (t.optionsLength ?? 0)} bytes`, '20 octets minimum, plus les options.'),
                f(`Flags : 0x${flagValue.toString(16).padStart(3, '0')} (${flagsText})`, 'Drapeaux de contrôle du segment.', 'tcp.flags', [
                    f(`Acknowledgment : ${has('ACK') ? 'Set' : 'Not set'}`, undefined, 'tcp.flags.ack'),
                    f(`Push : ${has('PSH') ? 'Set' : 'Not set'}`, undefined, 'tcp.flags.push'),
                    f(`Reset : ${has('RST') ? 'Set' : 'Not set'}`, undefined, 'tcp.flags.reset'),
                    f(`Syn : ${has('SYN') ? 'Set' : 'Not set'}`, undefined, 'tcp.flags.syn'),
                    f(`Fin : ${has('FIN') ? 'Set' : 'Not set'}`, undefined, 'tcp.flags.fin'),
                ]),
                f(`Window : ${t.win}`, 'Fenêtre de réception annoncée (à multiplier par le facteur d’échelle négocié).', 'tcp.window_size_value'),
                ...(t.options ? [f(`Options : ${t.options}`, 'Options négociées (MSS, SACK, horodatage, facteur d’échelle).')] : []),
                ...(t.retransmission
                    ? [f('[SEQ/ACK analysis] [This frame is a (suspected) retransmission]', 'Analyse de Wireshark : même numéro de séquence qu’un segment déjà vu, sans acquittement entre-temps.', 'tcp.analysis.retransmission')]
                    : []),
                ...(t.payload > 0 ? [f(`TCP payload (${t.payload} octets)`)] : []),
            ],
        });
        protocol = 'TCP';
        color = has('RST') ? 'rst' : has('SYN') || has('FIN') ? 'syn' : 'tcp';
        const opts = t.options && has('SYN') ? ` ${t.options}` : '';
        info = `${t.retransmission ? '[TCP Retransmission] ' : ''}${t.sport} → ${t.dport} [${flagsText}] Seq=${t.seq}${has('ACK') ? ` Ack=${t.ack}` : ''} Win=${t.win} Len=${t.payload}${opts}`;
        if (t.retransmission) color = 'bad';
    }

    // ---- DNS ----
    if (spec.dns) {
        protocols.push('dns');
        const d = spec.dns;
        add('dns.qry.name', d.name);
        add('dns.qry.type', d.type === 'A' ? 1 : 28);
        add('dns.flags.response', d.response ? 1 : 0);
        add('dns.id', d.id);
        if (d.answer) add('dns.a', d.answer);
        if (d.response) add('dns.flags.rcode', d.nxdomain ? 3 : 0);
        const flags = d.response ? (d.nxdomain ? '0x8183 Standard query response, No such name' : '0x8180 Standard query response, No error') : '0x0100 Standard query';
        tree.push({
            title: `Domain Name System (${d.response ? 'response' : 'query'})`,
            kind: 'app',
            fields: [
                f(`Transaction ID : ${d.id}`, 'Identifiant reliant la réponse à la question.', 'dns.id'),
                f(`Flags : ${flags}`, d.response ? 'QR = 1 (réponse), RD = 1, RA = 1, et le code de réponse.' : 'QR = 0 (question), RD = 1 (récursion demandée).', 'dns.flags', [
                    f(`Response : ${d.response ? 'Message is a response' : 'Message is a query'}`, undefined, 'dns.flags.response'),
                    f('Recursion desired : Do query recursively'),
                    ...(d.response ? [f('Recursion available : Server can do recursive queries'), f(`Reply code : ${d.nxdomain ? 'No such name (3)' : 'No error (0)'}`, undefined, 'dns.flags.rcode')] : []),
                ]),
                f(`Questions : 1, Answer RRs : ${d.answer ? 1 : 0}, Authority RRs : ${d.nxdomain ? 1 : 0}`),
                f(`Queries : ${d.name}: type ${d.type}, class IN`, 'La question posée.', 'dns.qry.name'),
                ...(d.answer ? [f(`Answers : ${d.name}: type ${d.type}, class IN, addr ${d.answer} (TTL ${d.ttl ?? 300})`, 'La réponse : adresse et durée de validité en cache.', 'dns.a')] : []),
                ...(d.nxdomain ? [f('Authoritative nameservers : example.com: type SOA', 'Enregistrement SOA permettant de mettre la réponse négative en cache.')] : []),
            ],
        });
        protocol = 'DNS';
        color = 'dns';
        info = d.response
            ? d.nxdomain
                ? `Standard query response ${d.id} No such name ${d.type} ${d.name} SOA …`
                : `Standard query response ${d.id} ${d.type} ${d.name} ${d.type} ${d.answer}`
            : `Standard query ${d.id} ${d.type} ${d.name}`;
    }

    // ---- DHCP ----
    if (spec.dhcp) {
        protocols.push('dhcp');
        const d = spec.dhcp;
        add('dhcp.option.dhcp', DHCP_TYPES[d.type]);
        if (d.yiaddr) add('dhcp.ip.your', d.yiaddr);
        tree.push({
            title: `Dynamic Host Configuration Protocol (${d.type})`,
            kind: 'app',
            fields: [
                f(`Message type : ${d.type === 'Discover' || d.type === 'Request' ? 'Boot Request (1)' : 'Boot Reply (2)'}`),
                f(`Transaction ID : ${d.xid}`, 'Même identifiant dans les quatre messages de l’échange.', 'dhcp.id'),
                f(`Your (client) IP address : ${d.yiaddr ?? '0.0.0.0'}`, 'Adresse proposée ou attribuée au client.', 'dhcp.ip.your'),
                f(`Option : (53) DHCP Message Type (${d.type})`, 'Type de message DHCP.', 'dhcp.option.dhcp'),
                ...(d.mask ? [f(`Option : (1) Subnet Mask (${d.mask})`)] : []),
                ...(d.router ? [f(`Option : (3) Router : ${d.router}`)] : []),
                ...(d.dns ? [f(`Option : (6) Domain Name Server : ${d.dns}`)] : []),
                ...(d.lease ? [f(`Option : (51) IP Address Lease Time (${d.lease} s)`)] : []),
            ],
        });
        protocol = 'DHCP';
        color = 'dhcp';
        info = `DHCP ${d.type} - Transaction ID ${d.xid}`;
    }

    // ---- TLS ----
    let encrypted = false;
    if (spec.tls) {
        protocols.push('tls');
        const t = spec.tls;
        for (const record of t.records) {
            if (TLS_TYPES[record]) add('tls.handshake.type', TLS_TYPES[record]);
            add('tls.record.content_type', record === 'Application Data' ? 23 : record === 'Change Cipher Spec' ? 20 : 22);
        }
        if (t.sni) add('tls.handshake.extensions_server_name', t.sni);
        encrypted = t.records.includes('Application Data');
        tree.push({
            title: 'Transport Layer Security',
            kind: 'security',
            fields: t.records.map((record) => {
                if (record === 'Client Hello') {
                    return f('TLSv1.3 Record Layer : Handshake Protocol : Client Hello', 'Premier message TLS du client.', 'tls.handshake.type', [
                        f('Version : TLS 1.2 (0x0303) — valeur de compatibilité ; la version réelle est dans supported_versions'),
                        f(`Extension : server_name (name=${t.sni})`, 'SNI : nom du site, visible en clair (sauf avec ECH).', 'tls.handshake.extensions_server_name'),
                        f('Extension : supported_versions (TLS 1.3, TLS 1.2)'),
                        f(`Extension : application_layer_protocol_negotiation (${t.alpn ?? 'h2, http/1.1'})`),
                        f('Extension : key_share (x25519)'),
                    ]);
                }
                if (record === 'Server Hello') return f('TLSv1.3 Record Layer : Handshake Protocol : Server Hello', 'Réponse du serveur : paramètres choisis et partage de clé. La suite du handshake est chiffrée.', 'tls.handshake.type');
                if (record === 'Change Cipher Spec') return f('TLSv1.3 Record Layer : Change Cipher Spec Protocol', 'Message conservé pour la compatibilité avec certains équipements ; sans rôle en TLS 1.3.');
                return f('TLSv1.3 Record Layer : Application Data Protocol', 'Données chiffrées : Wireshark ne peut pas les lire sans les clés de session.', 'tls.record.content_type', [
                    f('Opaque Type : Application Data (23)'),
                    f('Encrypted Application Data : (contenu illisible)'),
                ]);
            }),
        });
        protocol = 'TLSv1.3';
        color = 'tls';
        info = t.records.includes('Client Hello') ? `Client Hello (SNI=${t.sni})` : t.records.join(', ');
    }

    // ---- HTTP ----
    if (spec.http) {
        protocols.push('http');
        const h = spec.http;
        if (h.request) {
            add('http.request.method', h.request.method);
            add('http.request.uri', h.request.uri);
            add('http.host', h.request.host);
            tree.push({
                title: 'Hypertext Transfer Protocol',
                kind: 'app',
                fields: [
                    f(`${h.request.method} ${h.request.uri} HTTP/1.1\\r\\n`, 'Ligne de requête : méthode, chemin, version. Visible car la connexion n’est PAS chiffrée.', 'http.request.method'),
                    f(`Host: ${h.request.host}\\r\\n`, 'Nom du site demandé.', 'http.host'),
                    f('User-Agent: Mozilla/5.0 (…)\\r\\n'),
                    f('Accept: text/html\\r\\n'),
                ],
            });
            info = `${h.request.method} ${h.request.uri} HTTP/1.1`;
        }
        if (h.response) {
            add('http.response.code', h.response.code);
            tree.push({
                title: 'Hypertext Transfer Protocol',
                kind: 'app',
                fields: [
                    f(`HTTP/1.1 ${h.response.code} ${h.response.reason}\\r\\n`, 'Ligne de statut : le code 200 signifie que la requête a abouti.', 'http.response.code'),
                    f(`Content-Type: ${h.response.type}\\r\\n`),
                    f('Line-based text data : <!doctype html>… (lisible en clair)'),
                ],
            });
            info = `HTTP/1.1 ${h.response.code} ${h.response.reason}  (${h.response.type})`;
        }
        protocol = 'HTTP';
        color = 'http';
    }

    return {
        no,
        time: spec.time,
        src: spec.ip?.src ?? spec.eth.src,
        dst: spec.ip?.dst ?? (spec.eth.dst === 'ff:ff:ff:ff:ff:ff' ? 'Broadcast' : spec.eth.dst),
        protocol,
        length,
        info,
        color,
        tree,
        fields,
        protocols,
        beginner: spec.beginner,
        role: spec.role,
        lesson: spec.lesson,
        encrypted,
    };
}

export function buildCapture(specs: PacketSpec[]): CapturePacket[] {
    return specs.map((spec, index) => buildPacket(index + 1, spec));
}
