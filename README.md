# Ray

Minimal Django + DRF API scaffold for sunrise and sunset moments.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## API

- `GET /api/moments/`
- `POST /api/moments/`
- `GET /api/people/`
- `POST /api/people/`
