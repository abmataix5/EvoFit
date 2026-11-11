<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $sender->name }} quiere ser tu amigo en EvoFit</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111923;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="background:#ff8a4c;padding:20px 28px;font-size:20px;font-weight:800;color:#1a120c;">EvoFit</td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;line-height:1.3;">{{ $sender->name }} quiere ser tu amigo</p>
              @if ($sender->username)
                <p style="margin:0 0 16px;font-size:15px;color:#b8460e;font-weight:700;">{{ '@'.$sender->username }}</p>
              @endif
              <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#4d5b6c;">
                Si aceptas, podréis ver vuestros entrenos, daros «me gusta» y comentar.
              </p>
              <a href="{{ $appUrl }}/notifications" style="display:inline-block;background:#ff8a4c;color:#1a120c;text-decoration:none;font-weight:800;font-size:16px;padding:14px 24px;border-radius:14px;">Ver solicitud</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #eceff4;font-size:12px;line-height:1.5;color:#4d5b6c;">
              Recibes este email porque tienes cuenta en EvoFit.
              <a href="{{ $unsubscribeUrl }}" style="color:#4d5b6c;">No quiero recibir más avisos por email</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
