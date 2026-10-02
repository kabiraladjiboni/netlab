<?php

namespace App\Models;

use App\Models\Concerns\Publishable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Protocol extends Model
{
    use Publishable;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'ports' => 'array',
            'communication' => 'array',
            'fields' => 'array',
            'packet_example' => 'array',
            'mistakes' => 'array',
            'limits' => 'array',
            'variants' => 'array',
            'references' => 'array',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProtocolCategory::class, 'protocol_category_id');
    }

    public function layers(): BelongsToMany
    {
        return $this->belongsToMany(NetworkLayer::class)->orderBy('model')->orderBy('number');
    }

    public function relationships(): HasMany
    {
        return $this->hasMany(ProtocolRelationship::class);
    }

    public function terms(): BelongsToMany
    {
        return $this->belongsToMany(TechnicalTerm::class);
    }

    public function equipment(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class);
    }
}
