<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Seguro anti-desastres: los tests nunca deben tocar la base de datos real.
        $default = config('database.default');
        $database = config("database.connections.{$default}.database");
        if ($default !== 'sqlite' || $database !== ':memory:') {
            throw new RuntimeException("Tests abortados: la conexión es {$default} ({$database}), se esperaba sqlite :memory:.");
        }
    }
}
