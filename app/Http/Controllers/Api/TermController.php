<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TechnicalTerm;
use Illuminate\Http\JsonResponse;

class TermController extends Controller
{
    public function __invoke(string $slug): JsonResponse
    {
        $term = TechnicalTerm::published()->where('slug', $slug)->firstOrFail();

        return response()->json($term->toDetail());
    }
}
