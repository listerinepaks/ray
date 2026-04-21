from django.http import HttpResponse


def root(request):
    """Minimal landing page so `/` is not a 404."""
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ray</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    h1 { font-size: 1.5rem; }
    ul { padding-left: 1.2rem; }
    a { color: #0b5cab; }
  </style>
</head>
<body>
  <h1>Ray</h1>
  <p>Sunrise and sunset moments API.</p>
  <ul>
    <li><a href="/admin/">Django admin</a></li>
    <li><a href="/api/moments/">API — moments</a></li>
    <li><a href="/api/people/">API — people</a></li>
  </ul>
  <p><small>SPA login uses <code>POST /api/auth/login/</code> (session cookie). Web UI: <code>npm run dev</code> in <code>ray-web/</code>.</small></p>
</body>
</html>"""
    return HttpResponse(html)
