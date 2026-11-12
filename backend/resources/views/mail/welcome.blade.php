@php
$step = fn (string $n, string $title, string $text) => '
  <tr>
    <td style="padding:0 0 12px;vertical-align:top;width:40px;"><span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;background:#ff7a36;color:#1a120c;font-weight:800;border-radius:10px 4px 10px 4px;">'.$n.'</span></td>
    <td style="padding:0 0 12px;font-size:15px;line-height:1.45;color:#4d5b6c;"><strong style="color:#111923;">'.$title.'</strong><br>'.$text.'</td>
  </tr>';
$slot = '
  <p style="margin:0 0 12px;font-family:\'Arial Narrow\',\'Helvetica Neue\',Arial,sans-serif;font-size:28px;font-weight:900;font-style:italic;text-transform:uppercase;line-height:1.05;color:#111923;">¡Bienvenido a EvoFit, '.e($name).'!</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#4d5b6c;">Tu cuenta ya está lista. En tres pasos estás entrenando:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">'
    .$step('1', 'Crea tu rutina', 'Elige los días que entrenas y tus ejercicios.')
    .$step('2', 'Entrena y apunta', 'Kilos y repeticiones en dos toques; el descanso se cuenta solo.')
    .$step('3', 'Añade a tus amigos', 'Dales fuerza y compite en la liga de cada semana.')
  .'</table>
  <a href="'.e($appUrl).'/routines/new" style="display:inline-block;background:#ff7a36;color:#1a120c;text-decoration:none;font-weight:800;font-size:16px;padding:14px 24px;border-radius:14px 6px 14px 6px;">Crear mi primera rutina</a>
  <p style="margin:20px 0 0;font-size:14px;line-height:1.5;color:#4d5b6c;">Tu nombre de usuario es <strong style="color:#111923;">@'.e($username).'</strong>. Si quieres usarla como una app, añádela a la pantalla de inicio: <a href="'.e($appUrl).'/instalar" style="color:#b8460e;">cómo instalarla</a>.</p>';
$footer = 'Recibes este correo porque acabas de crear una cuenta en EvoFit. Si no has sido tú, escribe a <a href="mailto:info@evofit.fitness" style="color:#4d5b6c;">info@evofit.fitness</a> y la eliminamos.';
@endphp
@include('mail.layout', ['title' => 'Bienvenido a EvoFit', 'slot' => $slot, 'footer' => $footer])
