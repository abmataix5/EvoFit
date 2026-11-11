<?php

namespace App\Enums;

/** Quién puede ver el perfil y los entrenos de un usuario. */
enum ProfileVisibility: string
{
    case Public = 'public';
    case Friends = 'friends';
    case Private = 'private';
}
