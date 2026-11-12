<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Día en que se entrenó, en la hora local de quien entrena. Las horas se guardan en UTC, así
 * que un entreno a las 00:30 en España caía en el día (y a veces la semana) anterior en
 * progreso, rachas e historial. La fecha local se guarda aparte y es la que cuenta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workout_sessions', function (Blueprint $table) {
            $table->date('trained_on')->nullable()->after('scheduled_date');
        });

        // Los entrenos que ya existen: su hora de inicio (UTC) pasada a hora peninsular.
        DB::table('workout_sessions')
            ->whereNotNull('started_at')
            ->orderBy('id')
            ->select(['id', 'started_at'])
            ->chunkById(500, function ($sessions): void {
                foreach ($sessions as $session) {
                    $local = CarbonImmutable::parse($session->started_at, 'UTC')->setTimezone('Europe/Madrid');
                    DB::table('workout_sessions')->where('id', $session->id)->update(['trained_on' => $local->toDateString()]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('workout_sessions', function (Blueprint $table) {
            $table->dropColumn('trained_on');
        });
    }
};
