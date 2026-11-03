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
            if ($model->getAttribute('tenant_id') !== null) {
                return;
            }

            $tenantId = TenantContext::guard($model::class);
            if ($tenantId !== null) {
                $model->setAttribute('tenant_id', $tenantId);
            }
        });

        // En HTTP (EnforceTenantContext) falla cerrado: sin tenant no hay consulta.
        // En consola/colas no se exige y la consulta no se filtra.
        static::addGlobalScope('tenant', function (Builder $builder): void {
            $tenantId = TenantContext::guard($builder->getModel()::class);
            if ($tenantId !== null) {
                $builder->where($builder->getModel()->getTable().'.tenant_id', $tenantId);
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
