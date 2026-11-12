@php
$slot = '
  <p style="margin:0 0 8px;font-family:\'Arial Narrow\',\'Helvetica Neue\',Arial,sans-serif;font-size:28px;font-weight:900;font-style:italic;text-transform:uppercase;line-height:1.05;color:#111923;">'.e($sender->name).' quiere ser tu amigo</p>'
  .($sender->username ? '<p style="margin:0 0 16px;font-size:15px;color:#b8460e;font-weight:700;">@'.e($sender->username).'</p>' : '').'
  <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#4d5b6c;">Si aceptas, podréis ver vuestros entrenos, daros fuerza, comentar y competir en la liga de cada semana.</p>
  <a href="'.e($appUrl).'/notifications" style="display:inline-block;background:#ff7a36;color:#1a120c;text-decoration:none;font-weight:800;font-size:16px;padding:14px 24px;border-radius:14px 6px 14px 6px;">Ver solicitud</a>';
$footer = 'Recibes este email porque tienes cuenta en EvoFit. <a href="'.e($unsubscribeUrl).'" style="color:#4d5b6c;">No quiero recibir más avisos por email</a>.';
@endphp
@include('mail.layout', ['title' => $sender->name.' quiere ser tu amigo en EvoFit', 'slot' => $slot, 'footer' => $footer])
