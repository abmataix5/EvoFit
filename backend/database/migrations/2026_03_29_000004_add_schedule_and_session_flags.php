<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('routine_days', function (Blueprint $table) {
            $table->unsignedTinyInteger('weekday')->nullable()->after('day_index');
            // 1 = lunes … 7 = domingo
        });

        Schema::table('workout_sessions', function (Blueprint $table) {
            $table->boolean('is_planned')->default(true)->after('notes');
            $table->boolean('was_swapped')->default(false)->after('is_planned');
        });
    }

    public function down(): void
    {
        Schema::table('routine_days', function (Blueprint $table) {
            $table->dropColumn('weekday');
        });

        Schema::table('workout_sessions', function (Blueprint $table) {
            $table->dropColumn(['is_planned', 'was_swapped']);
        });
    }
};
