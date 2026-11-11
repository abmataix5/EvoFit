<?php

namespace App\Enums;

enum TrainingGoal: string
{
    case Strength = 'strength';
    case Muscle = 'muscle';
    case FatLoss = 'fat_loss';
    case Endurance = 'endurance';
    case Health = 'health';
}
