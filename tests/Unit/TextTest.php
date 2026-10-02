<?php

namespace Tests\Unit;

use App\Support\Text;
use PHPUnit\Framework\TestCase;

class TextTest extends TestCase
{
    public function test_normalize_retire_accents_et_majuscules(): void
    {
        $this->assertSame('resolveur dns', Text::normalize('  Résolveur   DNS '));
    }

    public function test_plain_retire_la_mini_syntaxe(): void
    {
        $this->assertSame('Le NAT traduit 192.168.1.10 vite', Text::plain('Le [[nat|NAT]] traduit `192.168.1.10` **vite**'));
    }
}
