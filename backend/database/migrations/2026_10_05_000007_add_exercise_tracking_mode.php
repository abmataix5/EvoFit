<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('catalog_exercises', function (Blueprint $table) {
            $table->string('tracking_mode', 20)->default('weight_reps')->after('target_muscle');
            $table->string('time_direction', 10)->default('faster')->after('tracking_mode');
            $table->unsignedSmallInteger('default_duration_seconds')->nullable()->after('default_reps');
        });

        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->string('tracking_mode', 20)->default('weight_reps')->after('target_muscle');
            $table->string('time_direction', 10)->default('faster')->after('tracking_mode');
            $table->unsignedSmallInteger('default_duration_seconds')->nullable()->after('default_reps');
        });

        Schema::table('exercise_set_logs', function (Blueprint $table) {
            $table->unsignedInteger('duration_seconds')->nullable()->after('reps');
        });
    }

    public function down(): void
    {
        Schema::table('exercise_set_logs', function (Blueprint $table) {
            $table->dropColumn('duration_seconds');
        });

        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->dropColumn(['tracking_mode', 'time_direction', 'default_duration_seconds']);
        });

        Schema::table('catalog_exercises', function (Blueprint $table) {
            $table->dropColumn(['tracking_mode', 'time_direction', 'default_duration_seconds']);
        });
    }
};
