<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Report\WorkoutReportRequest;
use App\Models\WorkoutSession;
use App\Services\WorkoutReportBuilder;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Informes PDF de entrenamiento: una sesión o un periodo (día, semana, mes o a medida).
 */
class WorkoutReportController extends Controller
{
    private const DEFAULT_TIMEZONE = 'Europe/Madrid';

    public function range(WorkoutReportRequest $request, WorkoutReportBuilder $builder): Response
    {
        $validated = $request->validated();
        $timezone = $validated['tz'] ?? self::DEFAULT_TIMEZONE;

        $report = $builder->forRange(
            $request->user(),
            CarbonImmutable::parse($validated['from']),
            CarbonImmutable::parse($validated['to']),
            $timezone,
        );

        if ($report === null) {
            return response()->json(['message' => 'No hay entrenamientos registrados en ese periodo.'], 404);
        }

        return $this->pdf($report, 'evofit-'.$report['period']['slug'].'.pdf');
    }

    public function session(Request $request, WorkoutSession $workoutSession, WorkoutReportBuilder $builder): Response
    {
        $this->authorize('view', $workoutSession);

        if (! $builder->sessionHasData($workoutSession)) {
            return response()->json(['message' => 'Esta sesión aún no tiene series registradas.'], 404);
        }

        $timezone = $request->query('tz');
        if (! is_string($timezone) || ! in_array($timezone, timezone_identifiers_list(\DateTimeZone::ALL_WITH_BC), true)) {
            $timezone = self::DEFAULT_TIMEZONE;
        }

        $report = $builder->forSession($request->user(), $workoutSession, $timezone);

        return $this->pdf($report, 'evofit-sesion-'.$workoutSession->scheduled_date->toDateString().'.pdf');
    }

    /**
     * @param  array<string, mixed>  $report
     */
    private function pdf(array $report, string $filename): Response
    {
        $logo = resource_path('reports/logo.png');
        $report['logo'] = is_file($logo) ? 'data:image/png;base64,'.base64_encode((string) file_get_contents($logo)) : null;

        $pdf = Pdf::loadView('reports.workout', $report)
            ->setPaper('a4')
            ->setOption([
                'isRemoteEnabled' => false,
                'isPhpEnabled' => false,
                'defaultFont' => 'Helvetica',
                'dpi' => 96,
            ]);

        // Numeración "Página X de Y" en el pie (CSS counter(pages) no funciona en dompdf).
        $pdf->render();
        $dompdf = $pdf->getDomPDF();
        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('Helvetica');
        $text = 'Página {PAGE_NUM} de {PAGE_COUNT}';
        $size = 6.4; // 8,5px del pie en puntos
        $width = $dompdf->getFontMetrics()->getTextWidth('Página 0 de 0', $font, $size);
        $canvas->page_text($canvas->get_width() - 30 - $width, $canvas->get_height() - 31, $text, $font, $size, [0.478, 0.529, 0.588]);

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
