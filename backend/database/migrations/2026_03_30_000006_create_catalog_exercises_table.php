<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('catalog_exercises', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('name_key', 180);
            $table->string('target_muscle')->nullable();
            $table->unsignedTinyInteger('default_sets')->default(3);
            $table->unsignedTinyInteger('default_reps')->default(10);
            $table->unsignedSmallInteger('rest_seconds')->default(90);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'name_key'], 'catalog_exercises_user_name_unique');
            $table->index(['tenant_id', 'user_id', 'name']);
        });

        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->foreignId('catalog_exercise_id')
                ->nullable()
                ->after('routine_day_id')
                ->constrained('catalog_exercises')
                ->nullOnDelete();
        });

        $this->backfillCatalogFromRoutines();
    }

    public function down(): void
    {
        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->dropConstrainedForeignId('catalog_exercise_id');
        });

        Schema::dropIfExists('catalog_exercises');
    }

    private function backfillCatalogFromRoutines(): void
    {
        $rows = DB::table('routine_exercises')
            ->join('routines', 'routines.id', '=', 'routine_exercises.routine_id')
            ->select([
                'routine_exercises.id as routine_exercise_id',
                'routine_exercises.tenant_id',
                'routines.user_id',
                'routine_exercises.name',
                'routine_exercises.default_sets',
                'routine_exercises.default_reps',
                'routine_exercises.rest_seconds',
                'routine_exercises.target_muscle',
                'routine_exercises.notes',
            ])
            ->orderBy('routine_exercises.id')
            ->get();

        $cache = [];

        foreach ($rows as $row) {
            $name = trim((string) $row->name);
            if ($name === '') {
                continue;
            }

            $nameKey = mb_strtolower($name);
            $cacheKey = $row->tenant_id.'|'.$row->user_id.'|'.$nameKey;

            if (! isset($cache[$cacheKey])) {
                $existingId = DB::table('catalog_exercises')
                    ->where('tenant_id', $row->tenant_id)
                    ->where('user_id', $row->user_id)
                    ->where('name_key', $nameKey)
                    ->value('id');

                if ($existingId) {
                    $cache[$cacheKey] = (int) $existingId;
                } else {
                    $cache[$cacheKey] = (int) DB::table('catalog_exercises')->insertGetId([
                        'tenant_id' => $row->tenant_id,
                        'user_id' => $row->user_id,
                        'name' => $name,
                        'name_key' => $nameKey,
                        'target_muscle' => $row->target_muscle,
                        'default_sets' => $row->default_sets ?? 3,
                        'default_reps' => $row->default_reps ?? 10,
                        'rest_seconds' => $row->rest_seconds ?? 90,
                        'notes' => $row->notes,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            DB::table('routine_exercises')
                ->where('id', $row->routine_exercise_id)
                ->update(['catalog_exercise_id' => $cache[$cacheKey]]);
        }
    }
};
