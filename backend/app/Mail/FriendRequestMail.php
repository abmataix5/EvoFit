<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Support\Facades\URL;

class FriendRequestMail extends Mailable
{
    public function __construct(public readonly User $sender, public readonly User $recipient) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "{$this->sender->name} quiere ser tu amigo en EvoFit");
    }

    public function headers(): Headers
    {
        // Botón "Cancelar suscripción" nativo de Gmail/Apple Mail.
        return new Headers(text: [
            'List-Unsubscribe' => '<'.$this->unsubscribeUrl().'>',
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.friend-request',
            text: 'mail.friend-request-text',
            with: [
                'appUrl' => rtrim((string) config('app.url'), '/'),
                'unsubscribeUrl' => $this->unsubscribeUrl(),
            ],
        );
    }

    private function unsubscribeUrl(): string
    {
        return URL::signedRoute('email.unsubscribe', ['user' => $this->recipient->id]);
    }
}
