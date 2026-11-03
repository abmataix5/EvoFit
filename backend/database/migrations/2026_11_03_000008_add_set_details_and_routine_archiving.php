<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exercise_set_logs', function (Blueprint $table) {
            $table->decimal('rpe', 3, 1)->nullable()->after('duration_seconds');
            $table->string('notes', 255)->nullable()->after('rpe');
        });

        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->after('notes');
        });

        Schema::table('routine_days', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->after('notes');
        });

        // Un día archivado conserva su day_index, así que el índice único ya no sirve:
        // la unicidad entre días activos se valida en la petición.
        Schema::table('routine_days', function (Blueprint $table) {
            $table->index('routine_id', 'routine_days_routine_id_index');
        });

        Schema::table('routine_days', function (Blueprint $table) {
            $table->dropUnique(['routine_id', 'day_index']);
        });
    }

    public function down(): void
    {
        Schema::table('routine_days', function (Blueprint $table) {
            $table->unique(['routine_id', 'day_index']);
        });

        Schema::table('routine_days', function (Blueprint $table) {
            $table->dropIndex('routine_days_routine_id_index');
            $table->dropColumn('archived_at');
        });

        Schema::table('routine_exercises', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });

        Schema::table('exercise_set_logs', function (Blueprint $table) {
            $table->dropColumn(['rpe', 'notes']);
        });
    }
};
