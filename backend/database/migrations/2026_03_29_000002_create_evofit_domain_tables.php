<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('routines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedTinyInteger('sessions_per_week')->default(3);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'is_active']);
        });

        Schema::create('routine_exercises', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('routine_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->unsignedTinyInteger('default_sets')->default(3);
            $table->unsignedTinyInteger('default_reps')->default(10);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['routine_id', 'sort_order']);
        });

        Schema::create('workout_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('routine_id')->constrained()->cascadeOnDelete();
            $table->date('scheduled_date');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'routine_id', 'scheduled_date'], 'workout_session_unique_day');
            $table->index(['tenant_id', 'scheduled_date']);
        });

        Schema::create('exercise_set_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workout_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('routine_exercise_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('set_number');
            $table->decimal('weight_kg', 8, 2)->nullable();
            $table->unsignedSmallInteger('reps')->nullable();
            $table->boolean('completed')->default(true);
            $table->timestamps();

            $table->unique(
                ['workout_session_id', 'routine_exercise_id', 'set_number'],
                'exercise_set_log_unique'
            );
        });

        Schema::create('body_weight_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('recorded_on');
            $table->decimal('weight_kg', 8, 2);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'recorded_on'], 'body_weight_unique_day');
        });

        Schema::create('progress_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('recorded_on');
            $table->string('disk')->default('public');
            $table->string('path');
            $table->string('caption')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'recorded_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('progress_photos');
        Schema::dropIfExists('body_weight_entries');
        Schema::dropIfExists('exercise_set_logs');
        Schema::dropIfExists('workout_sessions');
        Schema::dropIfExists('routine_exercises');
        Schema::dropIfExists('routines');
    }
};
