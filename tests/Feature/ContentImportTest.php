<?php

namespace Tests\Feature;

use App\Models\Lesson;
use App\Models\NetworkLayer;
use App\Models\Protocol;
use App\Models\ProtocolRelationship;
use App\Models\Quiz;
use App\Models\TechnicalTerm;
use App\Services\Content\ContentImporter;
use Tests\TestCase;

class ContentImportTest extends TestCase
{
    public function test_le_contenu_est_importe(): void
    {
        $this->assertGreaterThanOrEqual(80, Protocol::count());
        $this->assertSame(7, NetworkLayer::where('model', 'osi')->count());
        $this->assertSame(4, NetworkLayer::where('model', 'tcpip')->count());
        $this->assertGreaterThanOrEqual(60, TechnicalTerm::count());
        $this->assertGreaterThanOrEqual(10, Lesson::count());
    }

    public function test_l_import_est_idempotent(): void
    {
        $before = Protocol::count();
        $this->app->make(ContentImporter::class)->import();
        $this->assertSame($before, Protocol::count());
    }

    public function test_chaque_protocole_a_des_references_et_des_couches(): void
    {
        foreach (Protocol::with('layers')->get() as $protocol) {
            $this->assertNotEmpty($protocol->references, "{$protocol->slug} sans référence");
            $this->assertNotEmpty($protocol->layers, "{$protocol->slug} sans couche");
        }
    }

    public function test_les_relations_sont_reciproques(): void
    {
        foreach (ProtocolRelationship::all() as $relation) {
            $this->assertTrue(
                ProtocolRelationship::where('protocol_id', $relation->related_protocol_id)->where('related_protocol_id', $relation->protocol_id)->exists(),
                "Relation non réciproque {$relation->protocol_id} → {$relation->related_protocol_id}",
            );
        }
    }

    public function test_les_ports_connus_sont_exacts(): void
    {
        $expected = [
            'dns' => '53', 'https' => '443', 'ssh' => '22', 'bgp' => '179', 'ntp' => '123', 'snmp' => '161',
            'smtp' => '25', 'imap' => '143', 'telnet' => '23', 'dhcpv4' => '67', 'vxlan' => '4789', 'rdp' => '3389',
            'mqtt' => '1883', 'coap' => '5683', 'ldap' => '389', 'smb' => '445', 'sip' => '5060', 'tftp' => '69',
        ];
        foreach ($expected as $slug => $port) {
            $ports = collect(Protocol::where('slug', $slug)->firstOrFail()->ports)->pluck('number')->all();
            $this->assertContains($port, $ports, "Port attendu {$port} pour {$slug}");
        }
    }

    public function test_les_reponses_des_quiz_sont_valides(): void
    {
        foreach (Quiz::with('questions')->get() as $quiz) {
            foreach ($quiz->questions as $question) {
                $payload = $question->payload;
                match ($question->type) {
                    'single' => $this->assertArrayHasKey($payload['answer'], $payload['options']),
                    'multiple' => collect($payload['answer'])->each(fn ($index) => $this->assertArrayHasKey($index, $payload['options'])),
                    'order' => $this->assertGreaterThanOrEqual(3, count($payload['items'])),
                    'match' => $this->assertGreaterThanOrEqual(2, count($payload['pairs'])),
                };
            }
        }
    }
}
