<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Red social: amistades (solicitud → aceptar), bloqueos, denuncias y notificaciones.
 * Son relaciones entre usuarios de distintos espacios, así que no llevan tenant_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Avisos por email (solicitudes de amistad…); se pueden desactivar desde el perfil o el propio email.
            $table->boolean('email_notifications')->default(true)->after('show_age');
        });

        Schema::create('friendships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('requester_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('addressee_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('pending');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->unique(['requester_id', 'addressee_id']);
            $table->index(['addressee_id', 'status']);
            $table->index(['requester_id', 'status']);
        });

        Schema::create('user_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('blocked_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['blocker_id', 'blocked_id']);
            $table->index('blocked_id');
        });

        Schema::create('user_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reported_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason', 30);
            $table->string('details', 500)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index('reported_user_id');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('user_reports');
        Schema::dropIfExists('user_blocks');
        Schema::dropIfExists('friendships');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('email_notifications');
        });
    }
};
