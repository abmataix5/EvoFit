<?php

namespace App\Support;

use RuntimeException;

class TenantContext
{
    private static ?int $tenantId = null;

    /**
     * Cuando está activo (durante peticiones HTTP), consultar modelos de un
     * tenant sin contexto lanza una excepción en lugar de devolver datos de todos.
     */
    private static bool $enforced = false;

    public static function set(?int $tenantId): void
    {
        self::$tenantId = $tenantId;
    }

    public static function id(): ?int
    {
        return self::$tenantId;
    }

    public static function clear(): void
    {
        self::$tenantId = null;
    }

    public static function enforce(bool $enforced = true): void
    {
        self::$enforced = $enforced;
    }

    public static function isEnforced(): bool
    {
        return self::$enforced;
    }

    /**
     * Devuelve el tenant actual o falla si se exige y no hay contexto.
     */
    public static function guard(string $model): ?int
    {
        if (self::$tenantId === null && self::$enforced) {
            throw new RuntimeException("Acceso a {$model} sin contexto de tenant durante una petición HTTP.");
        }

        return self::$tenantId;
    }
}
