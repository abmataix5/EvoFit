<?php

namespace App\Models\Concerns;

use App\Models\Tenant;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToTenant
{
    protected static function bootBelongsToTenant(): void
    {
        static::creating(function (Model $model): void {
            if ($model->getAttribute('tenant_id') === null && TenantContext::id() !== null) {
                $model->setAttribute('tenant_id', TenantContext::id());
            }
        });

        static::addGlobalScope('tenant', function (Builder $builder): void {
            if (TenantContext::id() !== null) {
                $builder->where($builder->getModel()->getTable().'.tenant_id', TenantContext::id());
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
