<?php

namespace App\Console\Commands;

use App\Services\ExerciseLibrary;
use Illuminate\Console\Command;

class SyncExerciseLibrary extends Command
{
    protected $signature = 'exercises:sync';

    protected $description = 'Carga la biblioteca común de ejercicios y enlaza con ella los catálogos de los usuarios';

    public function handle(ExerciseLibrary $library): int
    {
        $count = $library->sync();
        $linked = $library->linkCatalog();

        $this->info("Biblioteca: {$count} ejercicios. Enlazados ahora: {$linked}.");

        return self::SUCCESS;
    }
}
