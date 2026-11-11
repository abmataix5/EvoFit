<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ejercicios "solo para hoy": un cambio o un añadido en una sesión concreta que no
 * toca la rutina. Viven en routine_exercises para que historial, récords e informes
 * (que cuelgan de routine_exercise_id) sigan funcionando igual.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->foreignId('workout_session_id')
                ->nullable()
                ->after('routine_day_id')
                ->constrained('workout_sessions')
                ->cascadeOnDelete();
            $table->foreignId('replaces_routine_exercise_id')
                ->nullable()
                ->after('workout_session_id')
                ->constrained('routine_exercises')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->dropConstrainedForeignId('replaces_routine_exercise_id');
            $table->dropConstrainedForeignId('workout_session_id');
        });
    }
};
