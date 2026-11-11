<?php

namespace App\Console\Commands;

use App\Services\Stories\StoryPublisher;
use Illuminate\Console\Command;

class PruneStories extends Command
{
    protected $signature = 'stories:prune';

    protected $description = 'Borra las historias caducadas (más de 24 h) y sus fotos';

    public function handle(StoryPublisher $publisher): int
    {
        $total = 0;
        do {
            $deleted = $publisher->pruneExpired();
            $total += $deleted;
        } while ($deleted > 0);

        $this->info("Historias caducadas borradas: {$total}.");

        return self::SUCCESS;
    }
}
