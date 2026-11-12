@php
$slot = '
  <p style="margin:0 0 12px;font-family:\'Arial Narrow\',\'Helvetica Neue\',Arial,sans-serif;font-size:28px;font-weight:900;font-style:italic;text-transform:uppercase;line-height:1.05;color:#111923;">Cambia tu contraseña</p>
  <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#4d5b6c;">Hola, '.e($name).'. Has pedido cambiar la contraseña de tu cuenta de EvoFit. Pulsa el botón para elegir una nueva.</p>
  <a href="'.e($url).'" style="display:inline-block;background:#ff7a36;color:#1a120c;text-decoration:none;font-weight:800;font-size:16px;padding:14px 24px;border-radius:14px 6px 14px 6px;">Elegir nueva contraseña</a>
  <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#4d5b6c;">El enlace caduca en '.$minutes.' minutos y solo sirve una vez.</p>
  <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#4d5b6c;word-break:break-all;">Si el botón no funciona, copia esta dirección en el navegador:<br>'.e($url).'</p>';
$footer = 'Si no has sido tú, no hagas nada: tu contraseña sigue siendo la misma.';
@endphp
@include('mail.layout', ['title' => 'Cambia tu contraseña de EvoFit', 'slot' => $slot, 'footer' => $footer])
