<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Response;

/**
 * Baja de los avisos por email desde el enlace firmado del propio correo (sin iniciar sesión).
 */
class EmailPreferenceController extends Controller
{
    public function unsubscribe(User $user): Response
    {
        $user->forceFill(['email_notifications' => false])->save();
        $appUrl = e(rtrim((string) config('app.url'), '/'));

        return response(<<<HTML
            <!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Avisos desactivados · EvoFit</title></head>
            <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f2f4f7;color:#111923;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px">
            <div style="background:#fff;border-radius:20px;padding:28px;max-width:420px">
            <h1 style="margin:0 0 8px;font-size:22px">Listo, no te enviaremos más avisos por email</h1>
            <p style="color:#4d5b6c;line-height:1.5">Puedes volver a activarlos cuando quieras desde tu perfil en EvoFit.</p>
            <a href="{$appUrl}/profile" style="display:inline-block;margin-top:8px;background:#ff8a4c;color:#1a120c;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:12px">Ir a EvoFit</a>
            </div></body></html>
            HTML);
    }
}
