<?php

namespace App\Support\Security;

/**
 * Mots de passe à usage unique basés sur le temps (TOTP, RFC 6238 / HOTP RFC 4226),
 * compatibles avec Google Authenticator, Microsoft Authenticator, Aegis, 2FAS, Bitwarden…
 * Paramètres standard : SHA-1, 6 chiffres, période de 30 secondes.
 */
final class Totp
{
    public const DIGITS = 6;

    public const PERIOD = 30;

    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /** Secret aléatoire de 160 bits encodé en Base32 (32 caractères). */
    public static function generateSecret(): string
    {
        return self::base32Encode(random_bytes(20));
    }

    public static function code(string $secret, int $step): string
    {
        $key = self::base32Decode($secret);
        $hash = hash_hmac('sha1', pack('J', $step), $key, true);
        $offset = ord($hash[19]) & 0x0F;
        $value = ((ord($hash[$offset]) & 0x7F) << 24) | ((ord($hash[$offset + 1]) & 0xFF) << 16)
            | ((ord($hash[$offset + 2]) & 0xFF) << 8) | (ord($hash[$offset + 3]) & 0xFF);

        return str_pad((string) ($value % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    public static function currentStep(?int $timestamp = null): int
    {
        return intdiv($timestamp ?? time(), self::PERIOD);
    }

    /**
     * Vérifie un code (tolérance d'un pas avant/après pour le décalage d'horloge).
     * Renvoie le pas de temps accepté, ou null. Un pas déjà utilisé est refusé (rejeu).
     */
    public static function verify(string $secret, string $code, ?int $lastUsedStep = null, ?int $timestamp = null): ?int
    {
        $code = preg_replace('/\D/', '', $code) ?? '';
        if (strlen($code) !== self::DIGITS) {
            return null;
        }
        $current = self::currentStep($timestamp);
        foreach ([0, -1, 1] as $drift) {
            $step = $current + $drift;
            if ($lastUsedStep !== null && $step <= $lastUsedStep) {
                continue;
            }
            if (hash_equals(self::code($secret, $step), $code)) {
                return $step;
            }
        }

        return null;
    }

    /** Adresse otpauth:// lue par les applications d'authentification (QR code). */
    public static function uri(string $secret, string $account, string $issuer): string
    {
        $label = rawurlencode($issuer).':'.rawurlencode($account);

        return 'otpauth://totp/'.$label.'?'.http_build_query([
            'secret' => $secret,
            'issuer' => $issuer,
            'algorithm' => 'SHA1',
            'digits' => self::DIGITS,
            'period' => self::PERIOD,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public static function base32Encode(string $data): string
    {
        $bits = '';
        foreach (str_split($data) as $char) {
            $bits .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 5) as $chunk) {
            $out .= self::ALPHABET[bindec(str_pad($chunk, 5, '0'))];
        }

        return $out;
    }

    public static function base32Decode(string $data): string
    {
        $data = strtoupper(preg_replace('/[\s=]/', '', $data) ?? '');
        $bits = '';
        foreach (str_split($data) as $char) {
            $index = strpos(self::ALPHABET, $char);
            if ($index === false) {
                throw new \InvalidArgumentException('Secret Base32 invalide.');
            }
            $bits .= str_pad(decbin($index), 5, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $out .= chr(bindec($byte));
            }
        }

        return $out;
    }
}
