@php
    use App\Services\WorkoutReportBuilder as R;

    $num = fn ($value, int $decimals = 0) => number_format((float) $value, $decimals, ',', '.');
    $kg = function ($value) use ($num) {
        if ($value === null) return '—';
        $value = (float) $value;
        return $num($value, fmod($value, 1.0) === 0.0 ? 0 : (fmod($value * 10, 1.0) === 0.0 ? 1 : 2));
    };
    $volume = fn ($value) => $value >= 10000 ? $num($value / 1000, 1).' t' : $num($value).' kg';
    $minutes = function (?int $m) {
        if (! $m) return '—';
        return $m >= 60 ? intdiv($m, 60).' h '.str_pad((string) ($m % 60), 2, '0', STR_PAD_LEFT).' min' : $m.' min';
    };
    $bestLabel = function (?array $best, string $mode) use ($kg) {
        if (! $best) return '—';
        if ($mode === 'time') return R::duration($best['seconds']);
        if ($mode === 'weight_time') {
            $parts = array_filter([$best['weight'] !== null ? $kg($best['weight']).' kg' : null, $best['seconds'] !== null ? R::duration($best['seconds']) : null]);
            return $parts ? implode(' · ', $parts) : '—';
        }
        if ($best['weight'] === null) return $best['reps'] !== null ? $best['reps'].' reps' : '—';
        return $kg($best['weight']).' kg × '.($best['reps'] ?? '—');
    };
    $delta = function ($current, $previous) {
        if ($previous === null || (float) $previous == 0.0) return null;
        $pct = (int) round(((float) $current - (float) $previous) / (float) $previous * 100);
        return ['pct' => $pct, 'up' => $pct >= 0];
    };
    $isRange = $type === 'range';
    $multi = count($sessions) > 1;
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>EvoFit · {{ $period['label'] }} · {{ $period['title'] }}</title>
<style>
    @page { margin: 118px 40px 64px 40px; }
    * { box-sizing: border-box; }
    body { font-family: Helvetica, 'DejaVu Sans', sans-serif; color: #18212d; font-size: 10px; line-height: 1.4; margin: 0; }

    /* Cabecera y pie fijos en todas las páginas */
    .header { position: fixed; top: -100px; left: -40px; right: -40px; height: 84px; background: #0b0f17; color: #fff; }
    .header-accent { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: #ff8a4c; }
    .header table { width: 100%; border-collapse: collapse; }
    .header td { vertical-align: middle; padding: 0; }
    .header .logo { width: 64px; height: 64px; display: block; margin: 10px 0 0 32px; }
    .header .brand { padding-left: 12px; }
    .header .brand-name { font-size: 17px; font-weight: bold; letter-spacing: 0.5px; }
    .header .brand-name span { color: #ff8a4c; }
    .header .brand-sub { font-size: 8.5px; color: #9fb0c4; letter-spacing: 1.4px; text-transform: uppercase; margin-top: 2px; }
    .header .meta { text-align: right; padding-right: 40px; font-size: 9px; color: #c5d0de; }
    .header .meta strong { color: #fff; font-size: 10px; }

    .footer { position: fixed; bottom: -44px; left: 0; right: 0; height: 24px; border-top: 1px solid #e3e8ef; padding-top: 6px; font-size: 8.5px; color: #7a8796; }
    .footer table { width: 100%; border-collapse: collapse; }

    /* Portada del informe */
    .eyebrow { font-size: 8.5px; font-weight: bold; color: #e8682a; text-transform: uppercase; letter-spacing: 1.6px; }
    h1 { font-size: 22px; margin: 3px 0 2px 0; color: #0c1219; line-height: 1.15; }
    .lead { color: #5b6878; font-size: 10.5px; margin: 0; }

    h2 { font-size: 13px; color: #0c1219; margin: 22px 0 8px 0; padding-bottom: 5px; border-bottom: 1.5px solid #0c1219; }
    h2 small { font-weight: normal; color: #7a8796; font-size: 9px; }

    /* KPIs */
    .kpis { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 16px -6px 0 -6px; }
    .kpi { background: #f4f6f9; border-radius: 6px; padding: 10px 11px; vertical-align: top; width: 25%; border-top: 3px solid #ff8a4c; }
    .kpi.alt { border-top-color: #0c1219; }
    .kpi-label { font-size: 7.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7889; font-weight: bold; }
    .kpi-value { font-size: 18px; font-weight: bold; color: #0c1219; margin-top: 3px; line-height: 1.1; }
    .kpi-note { font-size: 8px; color: #6b7889; margin-top: 2px; }
    .up { color: #2f8a2f; font-weight: bold; }
    .down { color: #c2410c; font-weight: bold; }

    /* Tablas */
    table.data { width: 100%; border-collapse: collapse; }
    table.data th { text-align: left; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7889; font-weight: bold; padding: 6px 7px; border-bottom: 1px solid #cfd7e1; background: #f4f6f9; }
    table.data td { padding: 6px 7px; border-bottom: 1px solid #edf0f4; vertical-align: top; }
    table.data tr:nth-child(even) td { background: #fafbfc; }
    table.data .num, table.data th.num { text-align: right; white-space: nowrap; }
    table.data .center { text-align: center; }
    table.data .strong { font-weight: bold; color: #0c1219; }
    table.data .muted { color: #8794a3; }
    table.data tr.rest td { color: #a3adb9; }
    table.data tfoot td { font-weight: bold; border-top: 1.5px solid #0c1219; border-bottom: none; background: #fff; }

    .bar-cell { width: 34%; }
    .bar-track { height: 7px; background: #edf0f4; border-radius: 4px; }
    .bar { height: 7px; background: #ff8a4c; border-radius: 4px; }

    /* Sesión */
    .session { margin-top: 18px; page-break-inside: auto; }
    .session-head { background: #0c1219; color: #fff; border-radius: 6px 6px 0 0; padding: 10px 12px; }
    .session-head table { width: 100%; border-collapse: collapse; }
    .session-head td { vertical-align: middle; padding: 0; }
    .session-date { font-size: 8px; text-transform: uppercase; letter-spacing: 1.2px; color: #ff9d66; font-weight: bold; }
    .session-title { font-size: 14px; font-weight: bold; margin-top: 1px; }
    .session-sub { font-size: 9px; color: #b5c2d1; margin-top: 1px; }
    .badge { display: inline-block; font-size: 7.5px; font-weight: bold; letter-spacing: 0.8px; text-transform: uppercase; padding: 3px 7px; border-radius: 9px; }
    .badge.done { background: #b6f36a; color: #102000; }
    .badge.open { background: #ffd166; color: #3a2a00; }
    .session-stats { width: 100%; border-collapse: collapse; background: #f4f6f9; border-radius: 0 0 6px 6px; }
    .session-stats td { padding: 7px 12px; width: 20%; border-right: 1px solid #e3e8ef; }
    .session-stats td:last-child { border-right: none; }
    .session-stats .l { font-size: 7px; text-transform: uppercase; letter-spacing: 0.9px; color: #6b7889; font-weight: bold; }
    .session-stats .v { font-size: 11.5px; font-weight: bold; color: #0c1219; }

    .exercise { margin-top: 12px; page-break-inside: avoid; }
    .exercise-head { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .exercise-head td { padding: 0; vertical-align: bottom; }
    .exercise-index { display: inline-block; width: 17px; height: 17px; line-height: 17px; border-radius: 9px; background: #ff8a4c; color: #1a120c; text-align: center; font-size: 8.5px; font-weight: bold; margin-right: 5px; }
    .exercise-name { font-size: 11.5px; font-weight: bold; color: #0c1219; }
    .exercise-meta { font-size: 8.5px; color: #7a8796; }
    .exercise-summary { text-align: right; font-size: 8.5px; color: #5b6878; }
    .exercise-summary strong { color: #0c1219; }
    .set-note { font-size: 8.5px; color: #6b7889; font-style: italic; }
    .tag { font-size: 7px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.6px; color: #c2410c; }

    .notes { margin-top: 10px; border-left: 3px solid #ff8a4c; background: #fff7f2; padding: 8px 11px; font-size: 9.5px; color: #3a4552; }
    .notes .l { font-size: 7.5px; text-transform: uppercase; letter-spacing: 1px; color: #c2410c; font-weight: bold; margin-bottom: 2px; }

    .glossary { margin-top: 22px; font-size: 8px; color: #8794a3; border-top: 1px solid #e3e8ef; padding-top: 7px; }
    .page-break { page-break-before: always; }
</style>
</head>
<body>

<div class="header">
    <table>
        <tr>
            <td style="width: 96px;">
                @if ($logo)
                    <img class="logo" src="{{ $logo }}" alt="EvoFit">
                @endif
            </td>
            <td class="brand">
                <div class="brand-name">Evo<span>Fit</span></div>
                <div class="brand-sub">{{ $period['label'] }}</div>
            </td>
            <td class="meta">
                <strong>{{ $user->name }}</strong><br>
                {{ $period['title'] }}
            </td>
        </tr>
    </table>
    <div class="header-accent"></div>
</div>

<div class="footer">
    <table>
        <tr>
            <td>EvoFit · {{ $period['label'] }} · Generado el {{ $generatedAt->locale('es')->isoFormat('D MMM YYYY, HH:mm') }}</td>
            <td style="text-align: right; width: 90px;"></td>
        </tr>
    </table>
</div>

{{-- Título --}}
<div class="eyebrow">{{ $isRange ? $period['label'] : 'Resumen de sesión' }}</div>
@if ($isRange)
    <h1>{{ $period['title'] }}</h1>
    <p class="lead">
        {{ $totals['sessions'] }} {{ $totals['sessions'] === 1 ? 'sesión' : 'sesiones' }}
        @if ($period['kind'] !== 'day')
            en {{ $totals['days'] }} {{ $totals['days'] === 1 ? 'día' : 'días' }} de entrenamiento
        @endif
        · {{ $totals['exercises'] }} {{ $totals['exercises'] === 1 ? 'ejercicio' : 'ejercicios' }} distintos
    </p>
@else
    @php $s = $sessions[0]; @endphp
    <h1>{{ $s['day'] }}</h1>
    <p class="lead">{{ $s['routine'] }} · {{ ucfirst($s['date']->isoFormat('dddd, D [de] MMMM [de] YYYY')) }}</p>
@endif

{{-- KPIs --}}
@php
    $dVolume = $previous ? $delta($totals['volume'], $previous['volume']) : null;
    $dSessions = $previous ? $delta($totals['sessions'], $previous['sessions']) : null;
    $dSets = $previous ? $delta($totals['sets'], $previous['sets']) : null;
    $prevLabel = ['week' => 'semana anterior', 'month' => 'mes anterior'][$period['kind']] ?? 'periodo anterior';
@endphp
<table class="kpis">
    <tr>
        @if ($isRange && $period['kind'] !== 'day')
            <td class="kpi">
                <div class="kpi-label">Sesiones</div>
                <div class="kpi-value">{{ $totals['sessions'] }}</div>
                <div class="kpi-note">
                    @if ($dSessions)<span class="{{ $dSessions['up'] ? 'up' : 'down' }}">{{ $dSessions['up'] ? '+' : '' }}{{ $dSessions['pct'] }}%</span> vs {{ $prevLabel }}
                    @else {{ $totals['completed'] }} completadas @endif
                </div>
            </td>
        @else
            <td class="kpi">
                <div class="kpi-label">Duración</div>
                <div class="kpi-value">{{ $minutes($totals['minutes'] ?: null) }}</div>
                <div class="kpi-note">
                    @if (! $multi && $sessions[0]['startedAt'])
                        {{ $sessions[0]['startedAt']->format('H:i') }}@if ($sessions[0]['completedAt']) – {{ $sessions[0]['completedAt']->format('H:i') }}@endif
                    @else
                        {{ $totals['sessions'] }} {{ $totals['sessions'] === 1 ? 'sesión' : 'sesiones' }}
                    @endif
                </div>
            </td>
        @endif
        <td class="kpi alt">
            <div class="kpi-label">Series</div>
            <div class="kpi-value">{{ $num($totals['sets']) }}</div>
            <div class="kpi-note">
                @if ($dSets)<span class="{{ $dSets['up'] ? 'up' : 'down' }}">{{ $dSets['up'] ? '+' : '' }}{{ $dSets['pct'] }}%</span> vs {{ $prevLabel }}
                @else {{ $totals['exercises'] }} {{ $totals['exercises'] === 1 ? 'ejercicio' : 'ejercicios' }} @endif
            </div>
        </td>
        <td class="kpi">
            <div class="kpi-label">Repeticiones</div>
            <div class="kpi-value">{{ $num($totals['reps']) }}</div>
            <div class="kpi-note">
                @if ($totals['seconds'] > 0) + {{ R::duration($totals['seconds']) }} bajo tiempo
                @else totales @endif
            </div>
        </td>
        <td class="kpi alt">
            <div class="kpi-label">Volumen</div>
            <div class="kpi-value">{{ $volume($totals['volume']) }}</div>
            <div class="kpi-note">
                @if ($dVolume)<span class="{{ $dVolume['up'] ? 'up' : 'down' }}">{{ $dVolume['up'] ? '+' : '' }}{{ $dVolume['pct'] }}%</span> vs {{ $prevLabel }}
                @else kilos × repeticiones @endif
            </div>
        </td>
    </tr>
</table>

{{-- Actividad del periodo (por días en una semana, por semanas en periodos largos) --}}
@if ($isRange && $activity)
    @php $weekly = $activity['granularity'] === 'week'; @endphp
    <h2>
        {{ $weekly ? 'Actividad por semana' : 'Actividad por día' }}
        <small>· {{ $totals['days'] }} {{ $totals['days'] === 1 ? 'día entrenado' : 'días entrenados' }}@if (! $weekly) de {{ count($activity['rows']) }}@endif</small>
    </h2>
    <table class="data">
        <thead>
            <tr>
                <th style="width: 17%;">{{ $weekly ? 'Semana' : 'Día' }}</th>
                <th>Entrenamiento</th>
                <th class="num" style="width: 8%;">Series</th>
                <th class="num" style="width: 10%;">Tiempo</th>
                <th class="num" style="width: 11%;">Volumen</th>
                <th class="bar-cell" style="width: 26%;"></th>
            </tr>
        </thead>
        <tbody>
            @foreach ($activity['rows'] as $row)
                <tr class="{{ $row['sessions'] === 0 ? 'rest' : '' }}">
                    <td class="{{ $row['sessions'] ? 'strong' : '' }}">{{ ucfirst($row['title']) }}</td>
                    <td>{{ $row['label'] }}</td>
                    <td class="num">{{ $row['sets'] ?: '—' }}</td>
                    <td class="num">{{ $minutes($row['minutes'] ?: null) }}</td>
                    <td class="num">{{ $row['volume'] > 0 ? $volume($row['volume']) : '—' }}</td>
                    <td class="bar-cell">
                        @if ($row['bar'] > 0)
                            <div class="bar-track"><div class="bar" style="width: {{ $row['bar'] }}%;"></div></div>
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endif

@if ($isRange && $multi && (! $activity || $activity['granularity'] === 'week'))
    <h2>Sesiones del periodo</h2>
    <table class="data">
        <thead>
            <tr>
                <th style="width: 18%;">Fecha</th>
                <th>Entrenamiento</th>
                <th class="num" style="width: 8%;">Series</th>
                <th class="num" style="width: 10%;">Tiempo</th>
                <th class="num" style="width: 12%;">Volumen</th>
                <th class="num" style="width: 11%;">Estado</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($sessions as $s)
                <tr>
                    <td class="strong">{{ ucfirst(str_replace('.', '', $s['date']->isoFormat('ddd D MMM'))) }}</td>
                    <td>{{ $s['day'] }} <span class="muted">· {{ $s['routine'] }}</span></td>
                    <td class="num">{{ $s['sets'] }}</td>
                    <td class="num">{{ $minutes($s['minutes']) }}</td>
                    <td class="num">{{ $s['volume'] > 0 ? $volume($s['volume']) : '—' }}</td>
                    <td class="num {{ $s['completed'] ? '' : 'muted' }}">{{ $s['completed'] ? 'Completada' : 'Sin cerrar' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endif

{{-- Resumen por ejercicio --}}
@if ($isRange && $period['kind'] !== 'day' && count($exercises) > 0)
    <h2>Resumen por ejercicio</h2>
    <table class="data">
        <thead>
            <tr>
                <th>Ejercicio</th>
                <th class="num" style="width: 9%;">Sesiones</th>
                <th class="num" style="width: 8%;">Series</th>
                <th class="num" style="width: 8%;">Reps</th>
                <th class="num" style="width: 17%;">Mejor marca</th>
                <th class="num" style="width: 10%;">1RM est.</th>
                <th class="num" style="width: 12%;">Volumen</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($exercises as $e)
                <tr>
                    <td><span class="strong">{{ $e['name'] }}</span>@if ($e['muscle'])<br><span class="muted">{{ $e['muscle'] }}</span>@endif</td>
                    <td class="num">{{ $e['sessions'] }}</td>
                    <td class="num">{{ $e['sets'] }}</td>
                    <td class="num">{{ $e['reps'] ?: '—' }}</td>
                    <td class="num strong">{{ $bestLabel($e['best'], $e['mode']) }}</td>
                    <td class="num">{{ $e['e1rm'] ? $kg(round($e['e1rm'], 1)).' kg' : '—' }}</td>
                    <td class="num">{{ $e['volume'] > 0 ? $volume($e['volume']) : ($e['seconds'] ? R::duration($e['seconds']) : '—') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>
@endif

{{-- Detalle de cada sesión --}}
@if ($isRange && $period['kind'] !== 'day')
    <div class="page-break"></div>
    <div class="eyebrow">Detalle</div>
    <h1 style="font-size: 18px;">Sesión a sesión</h1>
@endif

@foreach ($sessions as $s)
    <div class="session">
        <div class="session-head"@if (! $multi) style="border-radius: 6px;"@endif>
            <table>
                <tr>
                    <td>
                        <div class="session-date">
                            {{ $s['date']->isoFormat('dddd D [de] MMMM') }}
                            @if ($s['trainedOn']) · hecha el {{ $s['trainedOn']->isoFormat('ddd D MMM') }}@endif
                        </div>
                        <div class="session-title">{{ $s['day'] }}@if ($s['focus']) <span style="font-weight: normal; color: #b5c2d1;">· {{ $s['focus'] }}</span>@endif</div>
                        <div class="session-sub">
                            {{ $s['routine'] }}
                            @if ($s['startedAt']) · {{ $s['startedAt']->format('H:i') }}@if ($s['completedAt'] && $s['minutes']) – {{ $s['completedAt']->format('H:i') }}@endif @endif
                            @if ($s['swapped']) · día cambiado @endif
                        </div>
                    </td>
                    <td style="text-align: right; width: 90px;">
                        <span class="badge {{ $s['completed'] ? 'done' : 'open' }}">{{ $s['completed'] ? 'Completada' : 'Sin cerrar' }}</span>
                    </td>
                </tr>
            </table>
        </div>
        @if ($multi)
        <table class="session-stats">
            <tr>
                <td><div class="l">Duración</div><div class="v">{{ $minutes($s['minutes']) }}</div></td>
                <td><div class="l">Ejercicios</div><div class="v">{{ count($s['exercises']) }}</div></td>
                <td><div class="l">Series</div><div class="v">{{ $s['sets'] }}</div></td>
                <td><div class="l">Repeticiones</div><div class="v">{{ $num($s['reps']) }}</div></td>
                <td>
                    @if ($s['volume'] > 0)
                        <div class="l">Volumen</div><div class="v">{{ $volume($s['volume']) }}</div>
                    @elseif ($s['seconds'] > 0)
                        <div class="l">Tiempo de trabajo</div><div class="v">{{ R::duration($s['seconds']) }}</div>
                    @else
                        <div class="l">RPE medio</div><div class="v">{{ $s['avgRpe'] !== null ? $num($s['avgRpe'], 1) : '—' }}</div>
                    @endif
                </td>
            </tr>
        </table>
        @endif

        @forelse ($s['exercises'] as $i => $e)
            @php
                $hasWeight = collect($e['sets'])->contains(fn ($set) => $set['weight'] !== null);
                $hasReps = $e['mode'] === 'weight_reps' || collect($e['sets'])->contains(fn ($set) => $set['reps'] !== null);
                $hasTime = $e['mode'] !== 'weight_reps' || collect($e['sets'])->contains(fn ($set) => $set['seconds'] !== null);
                $hasRpe = collect($e['sets'])->contains(fn ($set) => $set['rpe'] !== null);
                $hasVolume = $e['volume'] > 0;
                $hasNotes = collect($e['sets'])->contains(fn ($set) => filled($set['notes']));
            @endphp
            <div class="exercise">
                <table class="exercise-head">
                    <tr>
                        <td>
                            <span class="exercise-index">{{ $i + 1 }}</span><span class="exercise-name">{{ $e['name'] }}</span>
                            <span class="exercise-meta">
                                @if ($e['muscle']) · {{ $e['muscle'] }}@endif · plan {{ $e['plan'] }}
                            </span>
                        </td>
                        <td class="exercise-summary">
                            Mejor: <strong>{{ $bestLabel($e['best'], $e['mode']) }}</strong>
                            @if ($e['e1rm']) · 1RM est. <strong>{{ $kg(round($e['e1rm'], 1)) }} kg</strong>@endif
                        </td>
                    </tr>
                </table>
                <table class="data">
                    <thead>
                        <tr>
                            <th style="width: 9%;">Serie</th>
                            @if ($hasWeight)<th class="num" style="width: 14%;">Peso</th>@endif
                            @if ($hasReps)<th class="num" style="width: 11%;">Reps</th>@endif
                            @if ($hasTime)<th class="num" style="width: 12%;">Tiempo</th>@endif
                            @if ($hasRpe)<th class="num" style="width: 9%;">RPE</th>@endif
                            @if ($hasVolume)<th class="num" style="width: 13%;">Volumen</th>@endif
                            <th>{{ $hasNotes ? 'Notas' : '' }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($e['sets'] as $set)
                            <tr>
                                <td class="strong">{{ $set['number'] }}</td>
                                @if ($hasWeight)<td class="num strong">{{ $set['weight'] !== null ? $kg($set['weight']).' kg' : '—' }}</td>@endif
                                @if ($hasReps)<td class="num">{{ $set['reps'] ?? '—' }}</td>@endif
                                @if ($hasTime)<td class="num">{{ R::duration($set['seconds']) }}</td>@endif
                                @if ($hasRpe)<td class="num">{{ $set['rpe'] !== null ? $num($set['rpe'], fmod($set['rpe'], 1.0) === 0.0 ? 0 : 1) : '—' }}</td>@endif
                                @if ($hasVolume)<td class="num muted">{{ $set['volume'] > 0 ? $num($set['volume']).' kg' : '—' }}</td>@endif
                                <td>
                                    @if (filled($set['notes']))<span class="set-note">{{ $set['notes'] }}</span>@endif
                                    @if (! $set['completed'])<span class="tag">{{ filled($set['notes']) ? ' · ' : '' }}Sin marcar</span>@endif
                                </td>
                            </tr>
                        @endforeach
                    </tbody>
                    @if (count($e['sets']) > 1 && ($hasVolume || $hasReps))
                        <tfoot>
                            <tr>
                                <td>Total</td>
                                @if ($hasWeight)<td class="num">{{ $e['topWeight'] !== null ? 'máx '.$kg($e['topWeight']).' kg' : '' }}</td>@endif
                                @if ($hasReps)<td class="num">{{ $e['reps'] ?: '—' }}</td>@endif
                                @if ($hasTime)<td class="num">{{ $e['seconds'] ? R::duration($e['seconds']) : '—' }}</td>@endif
                                @if ($hasRpe)<td></td>@endif
                                @if ($hasVolume)<td class="num">{{ $num($e['volume']) }} kg</td>@endif
                                <td></td>
                            </tr>
                        </tfoot>
                    @endif
                </table>
            </div>
        @empty
            <p class="lead" style="margin-top: 10px;">Sesión completada sin series registradas.</p>
        @endforelse

        @if (filled($s['notes']))
            <div class="notes">
                <div class="l">Notas de la sesión</div>
                {!! nl2br(e($s['notes'])) !!}
            </div>
        @endif
    </div>
@endforeach

<div class="glossary">
    <strong>Volumen</strong>: suma de kilos × repeticiones de cada serie. <strong>1RM est.</strong>: repetición máxima estimada con la fórmula de Epley (series de hasta 12 repeticiones).
    <strong>RPE</strong>: esfuerzo percibido (1–10). Las series «sin marcar» tienen datos pero no se marcaron como hechas.
</div>

</body>
</html>
