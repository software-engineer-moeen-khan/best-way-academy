# Best Way Academy — Laravel + MySQL

The repository contains a Laravel 12 backend while preserving the existing Udemy-style marketplace UI.

## Hostinger Web/Cloud — automated deployment

Run from the repository root, one level above `public_html`:

```bash
git fetch origin
git reset --hard origin/main
chmod +x deploy/hostinger-deploy.sh
./deploy/hostinger-deploy.sh
```

On the first deployment only, the script securely asks for a Hostinger API token. The token is not written to `.env` or committed. The script automatically:

- detects the Hostinger account/domain where possible;
- verifies PHP 8.2+ and Composer 2;
- creates `.env` and Laravel `APP_KEY`;
- creates the MySQL database/user through the Hostinger Hosting API if needed;
- generates a strong random database password and writes all DB values to `.env`;
- generates an admin account/password and stores a server-only copy in `.deploy/admin-credentials.txt`;
- runs migrations and seeders;
- publishes the existing HTML/assets into `public_html` without exposing protected learner/admin/instructor pages directly;
- installs Laravel's public `index.php` and rewrite rules;
- attempts to create Laravel's scheduler cron through the Hostinger API;
- caches production configuration.

Future deployments reuse `.env`, so the API token is normally not requested again.

Never commit `.env`, `.deploy/`, database passwords, or Hostinger API tokens.

## Local / VPS Docker

```bash
chmod +x deploy/local-docker.sh
./deploy/local-docker.sh
```

Open `http://localhost:8080`. Docker is optional and is intended for local development or a VPS. Hostinger Web/Cloud runs Laravel directly with PHP + Composer.

## Backend coverage

The backend provides Laravel-session authentication, MySQL courses/curriculum, checkout orders, enrollments, lesson progress, reviews, Q&A/answers, messages, instructor course/curriculum synchronization, user/global state persistence and role-protected learner/instructor/admin pages.

The `assets/backend-sync.js` compatibility layer lets the existing frontend keep its current UX while supported state is persisted to Laravel/MySQL.

Real payment capture is intentionally not faked: checkout creates real database orders/enrollments, while charging a card still requires connecting Stripe or another payment provider.
