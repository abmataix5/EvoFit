<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class WelcomeMail extends Mailable
{
    public function __construct(public readonly User $user) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: '¡Bienvenido a EvoFit!');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.welcome',
            text: 'mail.welcome-text',
            with: [
                'name' => $this->user->name,
                'username' => $this->user->username,
                'appUrl' => rtrim((string) config('app.url'), '/'),
            ],
        );
    }
}
