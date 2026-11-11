<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Alias público (@usuario) para buscar y añadir amigos. Nulo hasta que lo elija.
            $table->string('username', 30)->nullable()->unique()->after('name');
            $table->string('bio', 280)->nullable()->after('username');
            $table->string('location', 80)->nullable()->after('bio');
            $table->date('birth_date')->nullable()->after('location');
            $table->unsignedSmallInteger('height_cm')->nullable()->after('birth_date');
            $table->string('gym_name', 80)->nullable()->after('height_cm');
            $table->string('experience_level', 20)->nullable()->after('gym_name');
            $table->string('training_goal', 20)->nullable()->after('experience_level');
            // Quién ve el perfil y los entrenos cuando llegue el feed social.
            $table->string('profile_visibility', 20)->default('friends')->after('training_goal');
            $table->boolean('show_age')->default(true)->after('profile_visibility');
            $table->string('avatar_path')->nullable()->after('show_age');
            $table->timestamp('avatar_updated_at')->nullable()->after('avatar_path');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropColumn([
                'username', 'bio', 'location', 'birth_date', 'height_cm', 'gym_name',
                'experience_level', 'training_goal', 'profile_visibility', 'show_age',
                'avatar_path', 'avatar_updated_at',
            ]);
        });
    }
};
