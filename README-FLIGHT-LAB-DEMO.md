# Flight Lab Demo Backend Bundle

This bundle implements the hidden `/assets/flight-lab-7392.html` page as a **demo/virtual-credit simulator only**.

It intentionally contains **no real-money deposits, withdrawals, payment settlement, or cash payouts**.

## Included changes

- `app/Http/Controllers/FlightLabController.php`
  - Server-authoritative demo rounds
  - Two independent demo bet slots
  - Manual cash-out and optional auto cash-out
  - Transaction locking and duplicate cash-out protection
  - Demo balance persistence by anonymous browser key
  - Round history and recent demo activity
  - Balance reset when there are no open bets
- `database/migrations/2026_08_13_000020_create_flight_demo_tables.php`
  - `flight_demo_players`
  - `flight_demo_rounds`
  - `flight_demo_bets`
  - `flight_demo_transactions`
- `routes/admin-management.php`
  - `/api/flight-lab/state`
  - `/api/flight-lab/bets`
  - `/api/flight-lab/bets/{slot}`
  - `/api/flight-lab/cashout`
  - `/api/flight-lab/reset`
- `bootstrap/app.php`
  - CSRF exemption only for the hidden flight-demo API path (browser-key demo API)
- `assets/flight-lab-7392.html`
  - Functional two-panel demo controls
  - Virtual-credit wallet display
  - History/activity linked to backend
  - Preserves latest floating trail + aircraft bobbing animation
- `assets/flight-lab-7392.css`
- `assets/flight-lab-7392.js`

## Apply to the Git branch

Use these commands from a local clone of `software-engineer-moeen-khan/best-way-academy`:

```bash
git checkout awk-paid-courses-azadi-sale
git pull --ff-only origin awk-paid-courses-azadi-sale
```

Extract this ZIP **into the repository root** and allow the included files to overwrite the matching paths.
Then run:

```bash
php -l app/Http/Controllers/FlightLabController.php
php -l database/migrations/2026_08_13_000020_create_flight_demo_tables.php
php -l bootstrap/app.php
php -l routes/admin-management.php
node --check assets/flight-lab-7392.js

git add app/Http/Controllers/FlightLabController.php \
  database/migrations/2026_08_13_000020_create_flight_demo_tables.php \
  assets/flight-lab-7392.html assets/flight-lab-7392.css assets/flight-lab-7392.js \
  bootstrap/app.php routes/admin-management.php

git commit -m "Add demo flight lab virtual-credit backend"
git push origin awk-paid-courses-azadi-sale
```

After it is pushed, your existing Hostinger deployment flow can run normally. Its deploy script already runs Laravel migrations.

## Runtime behavior

- New browser receives `10,000.00 DEMO` credits.
- Demo stake range: `10.00` to `5,000.00` credits.
- A short betting window opens before each round.
- The server owns the round timestamps and hidden crash multiplier.
- The browser interpolates the multiplier visually between backend state polls.
- Manual cash-out is validated and settled on the server.
- Optional auto cash-out settles on the server even if the browser misses the exact polling instant.
- Every demo balance movement is recorded in `flight_demo_transactions`.

