<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ResetPasswordMail extends Mailable
{
    public function __construct(public readonly User $user, public readonly string $token) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Cambia tu contraseña de EvoFit');
    }

    public function content(): Content
    {
        $url = rtrim((string) config('app.url'), '/').'/restablecer?'.http_build_query([
            'token' => $this->token,
            'email' => $this->user->email,
        ]);

        return new Content(
            view: 'mail.reset-password',
            text: 'mail.reset-password-text',
            with: [
                'name' => $this->user->name,
                'url' => $url,
                'minutes' => (int) config('auth.passwords.users.expire', 60),
            ],
        );
    }
}
