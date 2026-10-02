<?php

namespace App\Http\Controllers\Admin;

use App\Models\AdminLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LogController extends AdminController
{
    public function index(Request $request): Response
    {
        $action = $request->string('action')->limit(60)->toString();

        return Inertia::render('admin/logs/index', [
            'logs' => AdminLog::with('user:id,name,email')
                ->when($action, fn ($q) => $q->where('action', 'like', addcslashes($action, '%_\\').'%'))
                ->latest('created_at')->paginate(40)->withQueryString()
                ->through(fn (AdminLog $log) => [
                    'id' => $log->id, 'action' => $log->action, 'subject_type' => $log->subject_type, 'label' => $log->subject_label,
                    'details' => $log->details, 'actor' => $log->user ? $log->user->name.' <'.$log->user->email.'>' : 'Console / système',
                    'date' => $log->created_at->toIso8601String(),
                ]),
            'actions' => AdminLog::query()->distinct()->orderBy('action')->pluck('action')->map(fn ($a) => explode('.', $a)[0])->unique()->values(),
            'filter' => $action,
        ]);
    }
}
