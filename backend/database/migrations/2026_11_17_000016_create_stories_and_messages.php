<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Historias de 24 h (foto o fondo con texto y stickers fitness) y mensajes privados
 * entre amigos (incluidas las respuestas y reacciones a historias).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('photo_path')->nullable();
            // Sin foto: fondo de la paleta de EvoFit (energy, lime, night, fire).
            $table->string('background', 20)->nullable();
            $table->string('text', 160)->nullable();
            // Stickers ya resueltos al publicar: {today: "Pierna", gym: "Basic Fit", streak: 3}.
            $table->json('stickers');
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->index(['user_id', 'expires_at']);
        });

        Schema::create('story_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('story_id')->constrained()->cascadeOnDelete();
            $table->foreignId('viewer_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['story_id', 'viewer_id']);
        });

        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            // Siempre user_one_id < user_two_id: una sola conversación por pareja.
            $table->foreignId('user_one_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('user_two_id')->constrained('users')->cascadeOnDelete();
            // Último mensaje leído por cada uno (por id: exacto aunque lleguen en el mismo segundo).
            $table->unsignedBigInteger('user_one_last_read_id')->nullable();
            $table->unsignedBigInteger('user_two_last_read_id')->nullable();
            $table->timestamp('last_message_at')->nullable()->index();
            $table->timestamps();

            $table->unique(['user_one_id', 'user_two_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->string('body', 1000)->nullable();
            // Respuesta o reacción a una historia (puede haber caducado: se queda en null).
            $table->foreignId('story_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reaction', 16)->nullable();
            // Se conserva aunque la historia caduque: "Respondió a tu historia".
            $table->boolean('story_reply')->default(false);
            $table->timestamps();

            $table->index(['conversation_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('story_views');
        Schema::dropIfExists('stories');
    }
};
