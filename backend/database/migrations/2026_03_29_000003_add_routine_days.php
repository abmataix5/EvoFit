<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('routine_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('routine_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_index');
            $table->string('name');
            $table->string('focus')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['routine_id', 'day_index']);
            $table->index(['tenant_id', 'routine_id']);
        });

        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->foreignId('routine_day_id')
                ->nullable()
                ->after('routine_id')
                ->constrained('routine_days')
                ->cascadeOnDelete();
            $table->unsignedSmallInteger('rest_seconds')->nullable()->after('default_reps');
            $table->string('target_muscle')->nullable()->after('rest_seconds');
        });

        // Migrar ejercicios existentes a "Día 1" por rutina.
        $routines = DB::table('routines')->get(['id', 'tenant_id', 'sessions_per_week', 'name']);
        foreach ($routines as $routine) {
            $dayId = DB::table('routine_days')->insertGetId([
                'tenant_id' => $routine->tenant_id,
                'routine_id' => $routine->id,
                'day_index' => 1,
                'name' => 'Día 1',
                'focus' => 'full',
                'notes' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('routine_exercises')
                ->where('routine_id', $routine->id)
                ->update(['routine_day_id' => $dayId]);

            $days = max(1, (int) $routine->sessions_per_week);
            for ($i = 2; $i <= $days; $i++) {
                DB::table('routine_days')->insert([
                    'tenant_id' => $routine->tenant_id,
                    'routine_id' => $routine->id,
                    'day_index' => $i,
                    'name' => 'Día '.$i,
                    'focus' => null,
                    'notes' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        Schema::table('workout_sessions', function (Blueprint $table) {
            $table->dropUnique('workout_session_unique_day');

            $table->foreignId('routine_day_id')
                ->nullable()
                ->after('routine_id')
                ->constrained('routine_days')
                ->nullOnDelete();

            $table->unique(
                ['tenant_id', 'user_id', 'routine_day_id', 'scheduled_date'],
                'workout_session_unique_day'
            );
        });
    }

    public function down(): void
    {
        Schema::table('workout_sessions', function (Blueprint $table) {
            $table->dropUnique('workout_session_unique_day');
            $table->dropConstrainedForeignId('routine_day_id');
            $table->unique(
                ['tenant_id', 'user_id', 'routine_id', 'scheduled_date'],
                'workout_session_unique_day'
            );
        });

        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->dropConstrainedForeignId('routine_day_id');
            $table->dropColumn(['rest_seconds', 'target_muscle']);
        });

        Schema::dropIfExists('routine_days');
    }
};
