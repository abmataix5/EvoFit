<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserReport extends Model
{
    public const REASONS = ['spam', 'harassment', 'inappropriate', 'impersonation', 'other'];

    protected $fillable = ['reporter_id', 'reported_user_id', 'reason', 'details'];
}
