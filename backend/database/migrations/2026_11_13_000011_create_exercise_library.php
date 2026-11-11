<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Biblioteca común de ejercicios (la misma para todos los usuarios) y el enlace desde
 * "Mis ejercicios": un mismo ejercicio para todos hace posibles comparativas y rankings.
 * Los datos se cargan con `php artisan exercises:sync` (database/data/exercise_library.json).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exercises', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('name', 120);
            $table->json('aliases');
            $table->string('muscle', 20)->index();
            $table->json('secondary_muscles');
            $table->string('equipment', 20);
            $table->string('mechanic', 20);
            $table->string('tracking_mode', 20)->default('weight_reps');
            $table->string('time_direction', 10)->default('faster');
            $table->unsignedTinyInteger('default_sets')->default(3);
            $table->unsignedTinyInteger('default_reps')->default(10);
            $table->unsignedSmallInteger('default_duration_seconds')->nullable();
            $table->unsignedSmallInteger('rest_seconds')->default(90);
            $table->json('cues');
            $table->boolean('has_image')->default(false);
            $table->timestamps();
        });

        Schema::table('catalog_exercises', function (Blueprint $table) {
            $table->foreignId('exercise_id')->nullable()->after('user_id')->constrained('exercises')->nullOnDelete();
            // Cada ejercicio de la biblioteca, como mucho una vez en "Mis ejercicios".
            $table->unique(['tenant_id', 'user_id', 'exercise_id'], 'catalog_exercises_user_library_unique');
        });
    }

    public function down(): void
    {
        Schema::table('catalog_exercises', function (Blueprint $table) {
            $table->dropUnique('catalog_exercises_user_library_unique');
            $table->dropConstrainedForeignId('exercise_id');
        });
        Schema::dropIfExists('exercises');
    }
};
