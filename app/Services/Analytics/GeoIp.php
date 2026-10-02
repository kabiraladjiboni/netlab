<?php

namespace App\Services\Analytics;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Estimation du PAYS à partir de l'adresse IP, sans service tiers :
 *  1. en-tête fourni par un proxy de confiance (ex. CF-IPCountry chez Cloudflare),
 *     uniquement si NETLAB_GEO_HEADER est configuré ;
 *  2. sinon, base locale de plages IP importée avec `php artisan netlab:geoip-import`
 *     (fichier CSV « IP to Country Lite » de DB-IP, licence CC BY 4.0).
 *
 * L'adresse IP n'est utilisée qu'en mémoire et n'est jamais enregistrée.
 * Le résultat reste une ESTIMATION (VPN, relais, réseaux mobiles…).
 */
class GeoIp
{
    public function country(Request $request): ?string
    {
        $header = config('netlab.geo.header');
        if ($header) {
            $value = strtoupper((string) $request->header($header));
            if (preg_match('/^[A-Z]{2}$/', $value) && ! in_array($value, ['XX', 'T1'], true)) {
                return $value;
            }
        }

        return $this->lookup((string) $request->ip());
    }

    public function lookup(string $ip): ?string
    {
        $key = self::toKey($ip);
        if ($key === null || ! $this->available()) {
            return null;
        }
        $row = DB::table('geo_ip_ranges')->where('range_start', '<=', $key)->orderByDesc('range_start')->first(['range_end', 'country']);
        if ($row === null || strcmp($key, $row->range_end) > 0) {
            return null;
        }

        return preg_match('/^[A-Z]{2}$/', $row->country) && $row->country !== 'ZZ' ? $row->country : null;
    }

    private ?bool $available = null;

    public function available(): bool
    {
        return $this->available ??= (bool) config('netlab.geo.header') || (Schema::hasTable('geo_ip_ranges') && DB::table('geo_ip_ranges')->exists());
    }

    /** Adresse IPv4/IPv6 → 32 caractères hexadécimaux comparables. */
    public static function toKey(string $ip): ?string
    {
        $packed = @inet_pton(trim($ip));
        if ($packed === false) {
            return null;
        }
        if (strlen($packed) === 4) {
            $packed = str_repeat("\0", 10)."\xff\xff".$packed;
        }

        return bin2hex($packed);
    }
}
