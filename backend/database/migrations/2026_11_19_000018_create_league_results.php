<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cómo quedó cada persona en su liga semanal (ella y sus amigos) una vez cerrada la semana.
 * Se guarda para que el resultado no cambie después (nuevos amigos, entrenos corregidos) y
 * para contar las semanas ganadas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('league_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('week_start');
            $table->unsignedSmallInteger('participants');
            // Puesto en cada modalidad; null si esa semana no puntuó.
            $table->unsignedSmallInteger('position_days')->nullable();
            $table->unsignedSmallInteger('position_volume')->nullable();
            $table->unsignedSmallInteger('position_records')->nullable();
            $table->unsignedSmallInteger('days')->default(0);
            $table->unsignedInteger('sets')->default(0);
            $table->unsignedInteger('volume_kg')->default(0);
            $table->unsignedSmallInteger('records')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'week_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('league_results');
    }
};
