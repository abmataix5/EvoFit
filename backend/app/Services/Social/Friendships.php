<?php

namespace App\Services\Social;

use App\Mail\FriendRequestMail;
use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\FriendRequestAccepted;
use App\Notifications\FriendRequestReceived;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

use function Illuminate\Support\defer;

/**
 * Solicitudes de amistad, aceptar, rechazar, eliminar y bloquear.
 */
class Friendships
{
    /**
     * Envía una solicitud. Si el otro ya me había enviado una, se acepta directamente.
     */
    public function request(User $from, User $to): Friendship
    {
        if ($from->id === $to->id) {
            throw ValidationException::withMessages(['user_id' => 'No puedes enviarte una solicitud a ti mismo.']);
        }
        if (UserBlock::eitherWay($from->id, $to->id)) {
            // Mismo mensaje que si no existiera: no se revela quién ha bloqueado a quién.
            abort(404);
        }

        $existing = Friendship::between($from->id, $to->id);
        if ($existing?->status === Friendship::ACCEPTED) {
            return $existing;
        }
        if ($existing && $existing->requester_id === $to->id) {
            return $this->accept($existing, $from);
        }
        if ($existing) {
            return $existing;
        }

        $friendship = Friendship::query()->create([
            'requester_id' => $from->id,
            'addressee_id' => $to->id,
            'status' => Friendship::PENDING,
        ]);

        $to->notify(new FriendRequestReceived($from, $friendship));
        $this->emailRequest($from, $to);

        return $friendship;
    }

    public function accept(Friendship $friendship, User $by): Friendship
    {
        abort_unless($friendship->addressee_id === $by->id, 403);
        if ($friendship->status === Friendship::ACCEPTED) {
            return $friendship;
        }

        $friendship->update(['status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $this->markRequestNotificationsRead($by, $friendship);
        $friendship->requester->notify(new FriendRequestAccepted($by));

        return $friendship;
    }

    /** Rechazar (quien la recibe) o cancelar (quien la envió) una solicitud pendiente. */
    public function dismiss(Friendship $friendship, User $by): void
    {
        abort_unless($friendship->involves($by->id) && $friendship->status === Friendship::PENDING, 404);

        $this->markRequestNotificationsRead($friendship->addressee, $friendship);
        $friendship->delete();
    }

    public function unfriend(User $user, User $other): void
    {
        Friendship::between($user->id, $other->id)?->delete();
    }

    /** Bloquear deshace la amistad o la solicitud que hubiera. */
    public function block(User $blocker, User $blocked): void
    {
        abort_if($blocker->id === $blocked->id, 422, 'No puedes bloquearte a ti mismo.');

        DB::transaction(function () use ($blocker, $blocked) {
            UserBlock::query()->firstOrCreate(['blocker_id' => $blocker->id, 'blocked_id' => $blocked->id]);
            Friendship::between($blocker->id, $blocked->id)?->delete();
        });
    }

    public function unblock(User $blocker, User $blocked): void
    {
        UserBlock::query()->where('blocker_id', $blocker->id)->where('blocked_id', $blocked->id)->delete();
    }

    /**
     * El email sale después de responder: un servidor de correo lento o caído no
     * retrasa ni rompe la solicitud (que ya está guardada y notificada en la app).
     */
    private function emailRequest(User $from, User $to): void
    {
        if (! $to->email_notifications) {
            return;
        }

        defer(function () use ($from, $to) {
            try {
                Mail::to($to)->send(new FriendRequestMail($from, $to));
            } catch (Throwable $e) {
                Log::warning('No se pudo enviar el email de solicitud de amistad', ['to' => $to->id, 'error' => $e->getMessage()]);
            }
        });
    }

    private function markRequestNotificationsRead(User $user, Friendship $friendship): void
    {
        $user->unreadNotifications()
            ->where('type', FriendRequestReceived::class)
            ->get()
            ->filter(fn ($n) => ($n->data['friendship_id'] ?? null) === $friendship->id)
            ->each->markAsRead();
    }
}
