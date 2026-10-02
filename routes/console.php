<?php

use Illuminate\Support\Facades\Schedule;

// Conservation limitée des données de mesure (voir Paramètres > Mesure d'audience).
Schedule::command('netlab:analytics-purge')->dailyAt('03:15');
