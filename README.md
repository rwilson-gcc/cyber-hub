# Cyber Security Learning Hub (Glasgow Clyde College)

Static hub + nine challenge rooms, with a small API that gives every learner a unique ID and saves their progress in the background.

## Run it

```bash
docker compose up -d --build
# open http://localhost:8080
```

Progress lives in the `hub-data` volume (`/data/hub.db`, SQLite). Back it up by copying that file.

Optional environment variables (put them in a `.env` file next to `docker-compose.yml`):

| Variable | Purpose |
|---|---|
| `ADMIN_TOKEN` | Long random string. Enables `GET /api/admin/export.csv` (header `Authorization: Bearer <token>`), one row per learner ID with tasks/flag per room. Disabled when unset. |
| `FORWARDED_ALLOW_IPS` | The IP/CIDR of your reverse proxy, so per-IP rate limits see real client addresses. |

Local development without Docker: `pip install -r server/requirements.txt && DATA_DIR=./data uvicorn server.main:app --port 8080`

## Layout

```
public/
  index.html                  hub
  rooms/*.html                one page per room (rooms 1-6 = Path 1, 7-9 = Path 2)
  css/base.css                tokens + rules shared by hub and rooms
  css/room.css                rules shared by every room
  css/rooms/<room>.css        hero colours and room-specific parts
  css/hub.css, learner.css    hub-only styles; brand bar + learner ID panel
  js/config.js                API base URL and save delay
  js/learner.js               learner ID, API client, ID panel
  js/room-progress.js         saves/restores any room automatically
  js/hub.js                   hub ticks + progress bar
  js/rooms/<room>.js          each room's own logic (unchanged from the originals,
                              plus a "Learner ID" line in the evidence file)
  js/rooms/sql-injection-engine.js   the in-browser SQL simulator for room 6
  img/                        GCC logo and Life Changing Stuff lockup
server/main.py                FastAPI: static files + /api
Dockerfile, docker-compose.yml
```

## How learner IDs and saving work

* First visit: the server issues an ID like `GCC-7K3M-9QXP-2WD4` (60 random bits). It is kept in the browser's localStorage and shown in the **Learner ID** button top right.
* The browser sends it in an `X-Learner-Id` header (never in the URL, so it stays out of access logs). Treat it like a password: anyone holding the ID can see that learner's progress.
* Any change in a room is saved ~1 second later. Entering the same ID on another device (Learner ID panel → *Carry on from another device*) restores everything.
* If the server is unreachable, progress is kept in localStorage and synced later. Without an API (e.g. plain GitHub Pages) everything still works, on that device only.
* Stored on the server: the ID, and per room the answers, quiz choices, hints used and flag status. **Not** stored: name and student ID from the export form (kept on the device only) and password fields. The evidence file includes the Learner ID so staff can match it to the CSV export.
* Protections: ID format validation, per-IP rate limits (new IDs, guessing of unknown IDs, general), body/state size limits, whitelisted room names, strict state sanitising, CSP and other security headers, non-root container, read-only filesystem.

## Adding a room

1. Copy an existing `rooms/*.html`, its `css/rooms/*.css` and `js/rooms/*.js`; keep the shared structure (`data-task` buttons with `#fb<n>` feedback, `#flag-in/#flag-btn/#flag-fb`, `#hint-btn/#hint-list`, `*-btn` quizzes with `*-fb`).
2. Set `<body data-room="your-slug">`. The server discovers rooms from `public/rooms/*.html`; saving works with no further code.
3. Add a card to `index.html` with `data-room="your-slug"`.

## Notes

* Flags are built in each room's browser script, as in the originals, so they are findable by reading the source. That is part of the teaching (reflection questions), not a security boundary.
* The learner ID reveals nothing personal, but it does link a learner's evidence file to their server-side progress.
