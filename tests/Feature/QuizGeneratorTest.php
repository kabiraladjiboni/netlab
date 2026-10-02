<?php

namespace Tests\Feature;

use App\Models\Protocol;
use App\Services\Content\QuizGenerator;
use Tests\TestCase;

class QuizGeneratorTest extends TestCase
{
    public function test_les_quiz_generes_ont_des_reponses_exactes(): void
    {
        $generator = new QuizGenerator;
        foreach (Protocol::with('layers')->get() as $protocol) {
            $quiz = $generator->forProtocol($protocol);
            $this->assertNotEmpty($quiz['questions'], $protocol->slug);
            foreach ($quiz['questions'] as $question) {
                if ($question['id'] === 'g1') {
                    $this->assertSame($protocol->problem, $question['options'][$question['answer']]);
                }
                if ($question['id'] === 'g2') {
                    $correct = (int) filter_var($question['options'][$question['answer']], FILTER_SANITIZE_NUMBER_INT);
                    $this->assertContains((string) $correct, collect($protocol->ports)->pluck('number')->all(), $protocol->slug);
                    $this->assertCount(count(array_unique($question['options'])), $question['options']);
                }
            }
        }
    }

    public function test_la_generation_est_deterministe(): void
    {
        $protocol = Protocol::where('slug', 'ssh')->firstOrFail();
        $this->assertSame((new QuizGenerator)->forProtocol($protocol), (new QuizGenerator)->forProtocol($protocol));
    }
}
