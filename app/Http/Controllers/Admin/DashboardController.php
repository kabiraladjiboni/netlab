<?php

namespace App\Http\Controllers\Admin;

use App\Models\AdminLog;
use App\Models\FeedbackReport;
use App\Models\User;
use App\Services\Analytics\Metrics;
use App\Services\Analytics\Period;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends AdminController
{
    public function index(Request $request, Metrics $metrics): Response
    {
        $period = Period::fromRequest($request);

        return Inertia::render('admin/dashboard', [
            'period' => $period->toArray(),
            'overview' => $metrics->overview($period),
            'presence' => $metrics->presence(),
            'series' => $metrics->series($period),
            'byCourse' => $metrics->activityByCourse($period),
            'feedback' => FeedbackReport::query()->whereIn('status', ['new', 'in_progress'])->latest()->limit(5)->get()
                ->map(fn (FeedbackReport $r) => ['id' => $r->id, 'category' => FeedbackReport::CATEGORIES[$r->category] ?? $r->category, 'message' => mb_strimwidth($r->message, 0, 120, '…'), 'status' => $r->status, 'date' => $r->created_at->toIso8601String()]),
            'recentLogs' => AdminLog::with('user:id,name')->latest('created_at')->limit(5)->get()
                ->map(fn (AdminLog $log) => ['id' => $log->id, 'action' => $log->action, 'label' => $log->subject_label, 'actor' => $log->user?->name ?? 'Console', 'date' => $log->created_at->toIso8601String()]),
            'demoData' => User::query()->where('email', 'like', '%@demo.netlab.test')->exists(),
        ]);
    }
}
