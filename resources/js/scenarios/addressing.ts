/**
 * Plan d'adressage pédagogique COMMUN à toutes les leçons et captures.
 *
 * Toutes les adresses publiques proviennent des plages réservées à la
 * documentation (RFC 5737 : 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24)
 * et les adresses MAC de la plage de documentation 00-00-5E-00-53-xx
 * (RFC 7042). Elles n'appartiennent à aucune machine réelle.
 * Chez un fournisseur d'accès béninois, l'adresse publique de la box
 * pourrait par exemple commencer par 41. ou 197. : c'est la même logique.
 */
export const NET = {
    domain: 'www.example.com',
    url: 'https://www.example.com',
    lan: { network: '192.168.1.0/24', mask: '255.255.255.0' },
    pc: { ip: '192.168.1.10', mac: '00:00:5e:00:53:0a' },
    phone: { ip: '192.168.1.23', mac: '00:00:5e:00:53:17' },
    box: { lanIp: '192.168.1.1', lanMac: '00:00:5e:00:53:01', wanIp: '203.0.113.25' },
    resolver: { ip: '192.0.2.53' },
    server: { ip: '198.51.100.20' },
    ports: {
        /** Port source éphémère choisi par le système de l'ordinateur. */
        client: 51514,
        /** Port source attribué par la box lors de la traduction PAT. */
        natted: 62001,
        phoneClient: 51514,
        phoneNatted: 62002,
        dnsClient: 53112,
        dnsNatted: 62003,
        https: 443,
        dns: 53,
    },
    tcp: {
        clientIsn: 2817394562,
        serverIsn: 1093847201,
    },
    ttl: { client: 64, server: 64 },
} as const;

export const assumptionsCommon = [
    'Les adresses IP publiques et MAC sont des adresses de documentation (RFC 5737 et RFC 7042) : elles ne désignent aucune machine réelle.',
    "L'ordinateur est relié à la box par un câble Ethernet. En Wi-Fi, le principe est identique mais la trame radio (IEEE 802.11) diffère.",
    'Valeur initiale du TTL : 64 (valeur courante sous Linux et macOS ; Windows utilise généralement 128).',
    "Le chemin à travers Internet est illustratif : un vrai trajet compte souvent 10 à 20 routeurs et peut changer d'un paquet à l'autre.",
];
