<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Ejercicio de la biblioteca común de EvoFit (no pertenece a ningún usuario).
 */
class Exercise extends Model
{
    /** Grupos musculares: clave interna => nombre que ve el usuario (y que se guarda en su catálogo). */
    public const MUSCLES = [
        'chest' => 'Pecho',
        'back' => 'Espalda',
        'shoulders' => 'Hombro',
        'traps' => 'Trapecio',
        'biceps' => 'Bíceps',
        'triceps' => 'Tríceps',
        'forearms' => 'Antebrazo',
        'quads' => 'Cuádriceps',
        'hamstrings' => 'Femoral',
        'glutes' => 'Glúteo',
        'calves' => 'Gemelo',
        'adductors' => 'Aductores',
        'abductors' => 'Abductores',
        'core' => 'Core',
        'lower_back' => 'Lumbar',
        'full_body' => 'Cuerpo completo',
        'cardio' => 'Cardio',
    ];

    protected $fillable = [
        'slug', 'name', 'aliases', 'muscle', 'secondary_muscles', 'equipment', 'mechanic',
        'tracking_mode', 'time_direction', 'default_sets', 'default_reps',
        'default_duration_seconds', 'rest_seconds', 'cues', 'has_image',
    ];

    protected function casts(): array
    {
        return [
            'aliases' => 'array',
            'secondary_muscles' => 'array',
            'cues' => 'array',
            'has_image' => 'boolean',
        ];
    }

    public function catalogEntries(): HasMany
    {
        return $this->hasMany(CatalogExercise::class);
    }

    public function muscleLabel(): string
    {
        return self::MUSCLES[$this->muscle] ?? $this->muscle;
    }

    /** @return array{0: string, 1: string}|null Posición inicial y final. */
    public function imageUrls(): ?array
    {
        if (! $this->has_image) {
            return null;
        }

        return ["/media/exercises/{$this->slug}/0.jpg", "/media/exercises/{$this->slug}/1.jpg"];
    }

    /** Minúsculas, sin tildes ni espacios sobrantes: así «Press Banca» y «press banca » coinciden. */
    public static function matchKey(string $text): string
    {
        $ascii = Str::ascii(mb_strtolower(trim($text)));

        return (string) preg_replace('/\s+/', ' ', preg_replace('/[^a-z0-9 ]+/', ' ', $ascii));
    }

    /** Nombre y sinónimos normalizados, para enlazar ejercicios escritos a mano. */
    public function matchKeys(): array
    {
        return array_values(array_unique(array_map(
            fn (string $text) => trim(self::matchKey($text)),
            [$this->name, ...($this->aliases ?? [])],
        )));
    }
}
