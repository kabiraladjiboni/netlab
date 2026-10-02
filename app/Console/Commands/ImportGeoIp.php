<?php

namespace App\Console\Commands;

use App\Services\Analytics\GeoIp;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Importe une base « plage IP → pays » au format CSV : début,fin,pays
 * (format du fichier gratuit « IP to Country Lite » de DB-IP, licence CC BY 4.0,
 * https://db-ip.com/db/download/ip-to-country-lite — attribution requise).
 */
class ImportGeoIp extends Command
{
    protected $signature = 'netlab:geoip-import {file : Chemin du fichier CSV (éventuellement .gz)}';

    protected $description = 'Importe une base locale IP → pays pour estimer l’origine géographique des visites.';

    public function handle(): int
    {
        $path = $this->argument('file');
        if (! is_readable($path)) {
            $this->error("Fichier illisible : {$path}");

            return self::FAILURE;
        }
        $handle = str_ends_with($path, '.gz') ? gzopen($path, 'r') : fopen($path, 'r');
        $rows = [];
        $count = 0;
        $skipped = 0;

        DB::transaction(function () use ($handle, &$rows, &$count, &$skipped) {
            DB::table('geo_ip_ranges')->delete();
            while (($line = fgetcsv($handle, 512, ',', '"', '\\')) !== false) {
                if (count($line) < 3) {
                    $skipped++;

                    continue;
                }
                $start = GeoIp::toKey($line[0]);
                $end = GeoIp::toKey($line[1]);
                $country = strtoupper(trim($line[2]));
                if ($start === null || $end === null || ! preg_match('/^[A-Z]{2}$/', $country)) {
                    $skipped++;

                    continue;
                }
                $rows[] = ['range_start' => $start, 'range_end' => $end, 'country' => $country];
                if (count($rows) === 1000) {
                    DB::table('geo_ip_ranges')->insert($rows);
                    $count += count($rows);
                    $rows = [];
                }
            }
            if ($rows !== []) {
                DB::table('geo_ip_ranges')->insert($rows);
                $count += count($rows);
            }
        });
        fclose($handle);

        $this->info("{$count} plages importées ({$skipped} lignes ignorées).");

        return self::SUCCESS;
    }
}
