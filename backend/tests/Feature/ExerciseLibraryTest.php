<?php

namespace Tests\Feature;

use App\Models\CatalogExercise;
use App\Models\Exercise;
use App\Services\ExerciseLibrary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsGymData;
use Tests\TestCase;

class ExerciseLibraryTest extends TestCase
{
    use BuildsGymData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('exercises:sync')->assertSuccessful();
    }

    public function test_library_data_file_is_consistent(): void
    {
        $rows = json_decode(file_get_contents(database_path(ExerciseLibrary::DATA_FILE)), true);
        // Las fotos viven en el frontend; dentro del contenedor del backend no está montado.
        $media = base_path('../frontend/public/media/exercises');
        $checkImages = is_dir($media);

        $this->assertGreaterThan(150, count($rows));
        $this->assertSame(count($rows), count(array_unique(array_column($rows, 'slug'))));
        foreach ($rows as $row) {
            $this->assertArrayHasKey($row['muscle'], Exercise::MUSCLES, $row['slug']);
            $this->assertContains($row['tracking_mode'], ['weight_reps', 'time', 'weight_time'], $row['slug']);
            $this->assertNotEmpty($row['cues'], $row['slug']);
            if ($checkImages && $row['image_source'] !== null) {
                $this->assertFileExists("{$media}/{$row['slug']}/0.jpg", $row['slug']);
                $this->assertFileExists("{$media}/{$row['slug']}/1.jpg", $row['slug']);
            }
        }
    }

    public function test_sync_is_idempotent(): void
    {
        $count = Exercise::query()->count();
        $this->artisan('exercises:sync')->assertSuccessful();
        $this->assertSame($count, Exercise::query()->count());
    }

    public function test_library_is_listed_with_images_and_labels(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->getJson('/api/v1/exercises')
            ->assertOk()
            ->assertJsonFragment([
                'slug' => 'press-banca',
                'name' => 'Press banca',
                'muscle' => 'chest',
                'muscle_label' => 'Pecho',
                'image_urls' => ['/media/exercises/press-banca/0.jpg', '/media/exercises/press-banca/1.jpg'],
            ]);
    }

    public function test_library_requires_authentication(): void
    {
        $this->getJson('/api/v1/exercises')->assertUnauthorized();
    }

    public function test_adding_from_library_creates_linked_entry_once(): void
    {
        $user = $this->makeUser();
        $bench = Exercise::query()->where('slug', 'press-banca')->firstOrFail();

        $first = $this->actingAs($user)->postJson('/api/v1/catalog-exercises', ['exercise_id' => $bench->id])
            ->assertCreated()
            ->assertJsonPath('exercise.exercise_id', $bench->id)
            ->assertJsonPath('exercise.name', 'Press banca')
            ->assertJsonPath('exercise.target_muscle', 'Pecho')
            ->assertJsonPath('exercise.image_urls.0', '/media/exercises/press-banca/0.jpg')
            ->json('exercise.id');

        $this->actingAs($user)->postJson('/api/v1/catalog-exercises', ['exercise_id' => $bench->id])
            ->assertOk()
            ->assertJsonPath('exercise.id', $first);
    }

    public function test_adding_from_library_links_existing_same_name_entry(): void
    {
        $user = $this->makeUser();
        $mine = $this->makeCatalog($user, 'press banca', ['default_sets' => 5]);
        $bench = Exercise::query()->where('slug', 'press-banca')->firstOrFail();

        $this->actingAs($user)->postJson('/api/v1/catalog-exercises', ['exercise_id' => $bench->id])
            ->assertOk()
            ->assertJsonPath('exercise.id', $mine->id)
            ->assertJsonPath('exercise.default_sets', 5);

        $this->assertSame($bench->id, $mine->refresh()->exercise_id);
    }

    public function test_existing_catalog_entries_are_linked_by_name_or_alias_keeping_data(): void
    {
        $user = $this->makeUser();
        [, , $exercises] = $this->makeRoutine($user, ['Bench Press' => [], 'Mi máquina rara' => []]);
        $session = $this->makeSession($exercises['Bench Press']->day, now()->toDateString(), now()->toDateTimeString());
        $this->logSet($session, $exercises['Bench Press'], 1, 100, 5);
        $accented = $this->makeCatalog($user, 'Sentadílla');

        // Simula catálogos de antes de la biblioteca.
        CatalogExercise::query()->update(['exercise_id' => null]);

        $this->assertGreaterThanOrEqual(1, app(ExerciseLibrary::class)->linkCatalog());

        $benchEntry = CatalogExercise::query()->where('name', 'Bench Press')->firstOrFail();
        $this->assertSame('press-banca', $benchEntry->exercise->slug);
        // El nombre del usuario y sus series no cambian.
        $this->assertSame('Bench Press', $benchEntry->name);
        $this->assertSame(1, $exercises['Bench Press']->setLogs()->count());
        $this->assertNull(CatalogExercise::query()->where('name', 'Mi máquina rara')->value('exercise_id'));
        $this->assertSame('sentadilla', $accented->refresh()->exercise?->slug);
    }

    public function test_custom_exercise_named_like_library_one_is_linked(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->postJson('/api/v1/catalog-exercises', ['name' => 'Hip Thrust'])
            ->assertCreated()
            ->assertJsonPath('exercise.exercise_id', Exercise::query()->where('slug', 'hip-thrust')->value('id'));

        $this->actingAs($user)->postJson('/api/v1/catalog-exercises', ['name' => 'Mi ejercicio inventado'])
            ->assertCreated()
            ->assertJsonPath('exercise.exercise_id', null);
    }

    public function test_link_and_unlink_custom_exercise(): void
    {
        $user = $this->makeUser();
        $mine = $this->makeCatalog($user, 'Press del gimnasio');
        $incline = Exercise::query()->where('slug', 'press-inclinado-maquina')->firstOrFail();

        $this->actingAs($user)->patchJson("/api/v1/catalog-exercises/{$mine->id}", ['exercise_id' => $incline->id])
            ->assertOk()
            ->assertJsonPath('data.exercise_id', $incline->id);

        $other = $this->makeCatalog($user, 'Otro press');
        $this->actingAs($user)->patchJson("/api/v1/catalog-exercises/{$other->id}", ['exercise_id' => $incline->id])
            ->assertJsonValidationErrors('exercise_id');

        $this->actingAs($user)->patchJson("/api/v1/catalog-exercises/{$mine->id}", ['exercise_id' => null])
            ->assertOk()
            ->assertJsonPath('data.exercise_id', null);
    }

    public function test_routine_with_typed_library_name_links_catalog(): void
    {
        $user = $this->makeUser();

        $this->actingAs($user)->postJson('/api/v1/routines', [
            'name' => 'Rutina',
            'sessions_per_week' => 1,
            'days' => [[
                'day_index' => 1, 'weekday' => 1, 'name' => 'A',
                'exercises' => [['name' => 'Dominadas', 'sort_order' => 0]],
            ]],
        ])->assertCreated();

        $this->assertSame('dominadas', CatalogExercise::query()->where('user_id', $user->id)->first()->exercise->slug);
    }
}
