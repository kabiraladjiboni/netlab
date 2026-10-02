<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Assistant\AssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssistantController extends Controller
{
    public function __invoke(Request $request, AssistantService $assistant): JsonResponse
    {
        $validated = $request->validate([
            'question' => ['required', 'string', 'min:2', 'max:'.config('netlab.ai.max_question_length')],
            'level' => ['required', 'integer', 'in:1,2,3'],
            'context' => ['nullable', 'array'],
            'context.page' => ['nullable', 'string', 'max:40'],
            'context.title' => ['nullable', 'string', 'max:200'],
            'context.focus' => ['nullable', 'string', 'max:200'],
            'context.excerpt' => ['nullable', 'string', 'max:1500'],
            'context.concepts' => ['nullable', 'array', 'max:12'],
            'context.concepts.*' => ['string', 'max:40'],
            'history' => ['nullable', 'array', 'max:6'],
            'history.*.role' => ['required', 'in:user,assistant'],
            'history.*.content' => ['required', 'string', 'max:1500'],
        ]);

        $context = array_filter($validated['context'] ?? [], fn ($value) => $value !== null);

        return response()->json($assistant->answer(
            trim($validated['question']),
            (int) $validated['level'],
            $context,
            array_values($validated['history'] ?? []),
        ));
    }
}
