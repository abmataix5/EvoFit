<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $title }}</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111923;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:22px 8px 22px 8px;overflow:hidden;">
          <tr>
            <td style="background:#0c1219;padding:22px 28px 20px;">
              <span style="font-family:'Arial Narrow','Helvetica Neue',Arial,sans-serif;font-size:30px;line-height:1;font-weight:900;font-style:italic;letter-spacing:0.01em;color:#f6f8fb;">EVO<span style="color:#ff7a36;">FIT</span></span>
              <div style="margin-top:6px;font-size:10px;font-weight:700;letter-spacing:0.2em;color:#8fa0b5;">ENTRENA &middot; MEJORA &middot; EVOLUCIONA</div>
            </td>
          </tr>
          <tr>
            <td style="height:6px;line-height:6px;font-size:0;background:#ff7a36;background-image:linear-gradient(90deg,#ffb347,#ff7a36 55%,#ee5a2c);">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px;">
              {!! $slot !!}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #eceff4;font-size:12px;line-height:1.5;color:#4d5b6c;">
              {!! $footer !!}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#8a96a6;">© {{ date('Y') }} EvoFit · <a href="https://evofit.fitness" style="color:#8a96a6;">evofit.fitness</a></p>
      </td>
    </tr>
  </table>
</body>
</html>
