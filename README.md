# Ray

Django + DRF API for sunrise and sunset moments, plus a small Vite + React app (`ray-web`).

## API setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Session and basic auth are enabled. For browser clients on another origin (e.g. the Vite dev server), CORS and `CSRF_TRUSTED_ORIGINS` are configured for `http://localhost:5173` and `http://127.0.0.1:5173`.

Uploads use the local filesystem by default (`./media`). To switch photo storage to a private S3-compatible bucket, install the production extras and set `DJANGO_STORAGE_BACKEND=s3` plus the `AWS_*` variables shown in `.env.example`.

## Web app (`ray-web`)

```bash
cd ray-web
npm install
npm run dev
```

The app uses **session auth**: sign in on the page (POST `/api/auth/login/` with CSRF), or use Django admin on the same host — same cookie. Override the API base with `VITE_API_URL` if needed (otherwise the hostname matches this page + port 8000).

**Routes:** `/` timeline; `/moments/new` create moment; `/moments/:id` entry. Static hosting needs `index.html` for client-side routes (e.g. nginx `try_files $uri /index.html`).

## API

**Auth (JSON, session cookie)**

- `GET` `/api/auth/csrf/` — sets `csrftoken` cookie (call before `POST` from the browser)
- `POST` `/api/auth/login/` — body `{"username","password"}`, header `X-CSRFToken` when required
- `POST` `/api/auth/logout/`
- `GET` `/api/auth/me/` — `401` if anonymous
- `GET` `/api/auth/users/` — `{ "users": [ { "id", "username" }, ... ] }` for custom sharing pickers (small deployments)

**Photos (multipart, edit access on the moment)**

- `GET`, `POST` `/api/moments/{moment_id}/photos/`
- `GET`, `PUT`, `PATCH`, `DELETE` `/api/moments/{moment_id}/photos/{id}/` — `POST` sends `image` (file), optional `caption`, `sort_order`

**Moments & people**

- `GET`, `POST` `/api/moments/`
- `GET`, `PUT`, `PATCH`, `DELETE` `/api/moments/{id}/`
- `GET`, `POST` `/api/people/`
- `GET`, `PUT`, `PATCH`, `DELETE` `/api/people/{id}/`

**Comments & reactions** (nested under a moment; require access on that moment)

- `GET`, `POST` `/api/moments/{moment_id}/comments/`
- `GET`, `PUT`, `PATCH`, `DELETE` `/api/moments/{moment_id}/comments/{id}/`
- `GET`, `POST` `/api/moments/{moment_id}/reactions/`
- `GET`, `DELETE` `/api/moments/{moment_id}/reactions/{id}/`

**Permissions**

- Listing a moment requires any row in `MomentAccess` for you (or authorship, represented as edit access).
- Updating or deleting a moment requires **edit** access on that moment.
- Creating comments and reactions requires **comment** or **edit** access. Editing or deleting a comment is allowed for the comment author or anyone with edit on the moment. Deleting a reaction is allowed for the reacting user or anyone with edit on the moment.

Moment responses include `my_access` (`view`, `comment`, `edit`, or `null`) for the current user.

## Production — `ray.wright5.us`

Deploy tree assumed: **`/opt/ray`** (adjust paths in `nginx/nginx-production.conf` and `supervisorctl/supervisord.conf` if yours differ).

### One-time server setup

1. **DNS**: Point `ray.wright5.us` at the server (`A` / `AAAA`).

2. **Directories** (as root or deploy user):

   ```bash
   sudo mkdir -p /opt/ray/run /opt/ray/media /opt/ray/static /var/log/ray
   sudo chown -R deploy:www-data /opt/ray /var/log/ray   # replace deploy with your app user
   ```

3. **Code**: Clone or rsync this repo to `/opt/ray`, then:

   ```bash
   cd /opt/ray
   python3.12 -m venv .venv
   source .venv/bin/activate
   pip install -U pip
   pip install -e ".[prod]"
   ```

4. **Environment**: Copy `deploy/production.env.example` to e.g. `/opt/ray/.env`, set **`DJANGO_SECRET_KEY`** (long random string; do not commit it), and keep **`DJANGO_DEBUG=0`**. Load it wherever you start Gunicorn, for example:

   ```bash
   set -a && source /opt/ray/.env && set +a
   python manage.py migrate
   python manage.py collectstatic --noinput
   python manage.py createsuperuser   # optional, for admin + first logins
   python manage.py check --deploy
   ```

5. **TLS**: Issue certificates (e.g. Certbot). The sample nginx config redirects HTTP → HTTPS and expects certs under `/etc/letsencrypt/live/ray.wright5.us/`. Until certs exist, you can serve only `:80` with a temporary server block or use Certbot’s standalone/webroot flow.

6. **Nginx**: Copy or include `nginx/nginx-production.conf` (e.g. `/etc/nginx/sites-available/ray` → `sites-enabled`). Reload: `sudo nginx -t && sudo systemctl reload nginx`.

   - **`/`** → static SPA from `/opt/ray/ray-web/dist` (`try_files` → `index.html` for client routes).
   - **`/api/`**, **`/admin/`** → Gunicorn via unix socket.
   - **`/static/`**, **`/media/`** → Django `collectstatic` output and user uploads when using local filesystem media.

7. **Gunicorn**: Edit `supervisorctl/supervisord.conf` so **`command=`** points at your venv’s `gunicorn` (e.g. `/opt/ray/.venv/bin/gunicorn`), **`user=`** matches the account that owns `/opt/ray`, and **`directory=`** is `/opt/ray`. Install the `[program:gunicorn]` section, then `supervisorctl reread && supervisorctl update && supervisorctl start ray:gunicorn`.

8. **Frontend build** (on the server or CI; copy `dist/` to the server):

   ```bash
   cd /opt/ray/ray-web
   npm ci
   npm run build
   ```

   With nginx as above, the built files belong at **`/opt/ray/ray-web/dist`**. No `VITE_API_URL` is required if the site and API share **https://ray.wright5.us** (the app uses `window.location.origin` in production).

9. **SQLite**: Default DB is `db.sqlite3` in the project root — **back it up** (copy/backup) before upgrades. For heavier load, switch to Postgres later and point `DATABASES` in `config/settings.py` via environment variables.

### Private S3 media storage

If you want uploaded photos in a private S3-compatible bucket instead of `/opt/ray/media`:

```bash
cd /opt/ray
source .venv/bin/activate
pip install -e ".[prod]"
set -a && source /opt/ray/.env && set +a
python manage.py check
```

Set these env vars in `/opt/ray/.env`:

```bash
DJANGO_STORAGE_BACKEND=s3
AWS_STORAGE_BUCKET_NAME=ray-media
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_REGION_NAME=us-east-1
```

Optional for S3-compatible providers:

```bash
AWS_S3_ENDPOINT_URL=https://<provider-endpoint>
AWS_S3_CUSTOM_DOMAIN=<cdn-or-custom-hostname>
AWS_QUERYSTRING_EXPIRE=3600
AWS_S3_VERIFY=1
```

Recommended bucket posture:

- Block all public access.
- Keep object ACLs disabled.
- Enable bucket encryption.
- Enable versioning if you want recovery from deletes or overwrites.

With `DJANGO_STORAGE_BACKEND=s3`, uploaded photos still use the same `people/` and `moments/` prefixes from the Django models; you do not need to create folders in the bucket first.

### Deploy / upgrade (repeat)

```bash
cd /opt/ray && git pull   # or deploy artifact
source .venv/bin/activate
set -a && source /opt/ray/.env && set +a
pip install -e ".[prod]"
python manage.py migrate
python manage.py collectstatic --noinput
cd ray-web && npm ci && npm run build && cd ..
sudo supervisorctl restart ray:gunicorn
sudo nginx -t && sudo systemctl reload nginx
```

### Mobile testers (Expo)

Point the app at production:

```bash
EXPO_PUBLIC_API_URL=https://ray.wright5.us
```

Build a dev client or use Expo Go with that env (see `ray-mobile` / `app.json`). Session vs token: the mobile app uses the **token** auth path against the same API base.

### Unix socket / 502 from nginx

- **Config**: Nginx must proxy via an `upstream` block pointing at `unix:/opt/ray/run/django.sock` (see `nginx/nginx-production.conf`; the upstream is named `ray_gunicorn` so it does not collide with other Django sites on the same server). A bare `proxy_pass http://unix:/path.sock` without the correct form often fails.
- **Run dir**: `sudo mkdir -p /opt/ray/run && sudo chown deploy:www-data /opt/ray/run && sudo chmod 2775 /opt/ray/run` so Gunicorn (as `deploy`) can create the socket and nginx (`www-data`) can connect. The **`2`** in `2775` is **setgid**: new files in that directory (including `django.sock`) get group **`www-data`**, not `deploy`. If the socket shows **`deploy:deploy`**, fix the directory (not only the socket), remove the old `django.sock`, and restart Gunicorn.
- **Supervisor**: `[program:gunicorn]` should have **`user=deploy`** and **`group=www-data`** (see `supervisorctl/supervisord.conf`). If your live config omits `group=`, add it or rely on setgid on `/opt/ray/run` as above.
- **Stale socket**: If Gunicorn died, remove `django.sock` and restart: `sudo supervisorctl restart ray:gunicorn`.
- **Logs**: `tail /var/log/ray/gunicorn.err.log` and `sudo tail /var/log/nginx/error.log`.

**`No such file or directory` on `django.sock`** — the socket is only created when Gunicorn starts and binds. Nginx is not the fix; Ray’s Gunicorn process is failing or not running.

1. Use **`config.wsgi:application`** and **`directory=/opt/ray`** (not `ray.wsgi`, not a non-existent `/opt/ray/app`).
2. Match the real venv in Supervisor: `/opt/ray/.venv/bin/gunicorn` or `/opt/ray/venv/bin/gunicorn`.
3. Read **`/var/log/ray/gunicorn.err.log`** for Django import errors or missing `DJANGO_SECRET_KEY`.
4. Manual test as `deploy` (stop `ray:gunicorn` first):  
   `sudo -u deploy bash -lc 'cd /opt/ray && set -a && . /opt/ray/.env && set +a && exec /opt/ray/.venv/bin/gunicorn config.wsgi:application --bind unix:/opt/ray/run/django.sock --umask 007'`  
   Then `ls -l /opt/ray/run/django.sock`. If logs mention another app (Neo4j, etc.), Ray’s Supervisor stanza is wrong or logging to the wrong file.
