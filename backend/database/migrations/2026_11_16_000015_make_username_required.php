<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * El alias (@usuario) pasa a ser obligatorio: es como se te ve en el feed, comentarios y avisos.
 * A quien no lo tenía se le asigna uno a partir de su nombre (lo puede cambiar en su perfil).
 */
return new class extends Migration
{
    public function up(): void
    {
        $taken = DB::table('users')->whereNotNull('username')->pluck('username')->map(fn ($u) => mb_strtolower($u))->flip()->all();

        DB::table('users')->whereNull('username')->orderBy('id')->get(['id', 'name'])->each(function ($user) use (&$taken) {
            $base = substr((string) preg_replace('/[^a-z0-9]+/', '', Str::ascii(mb_strtolower((string) $user->name))), 0, 20);
            if (strlen($base) < 3) {
                $base = 'atleta';
            }

            $candidate = $base;
            for ($n = 2; isset($taken[$candidate]); $n++) {
                $candidate = $base.$n;
            }
            $taken[$candidate] = true;

            DB::table('users')->where('id', $user->id)->update(['username' => $candidate]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 30)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 30)->nullable()->change();
        });
    }
};
