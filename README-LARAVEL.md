# Best Way Academy — Laravel + MySQL

The repository contains a Laravel 12 backend while preserving the existing Udemy-style marketplace UI.

## Hostinger Web/Cloud — one-command deployment

This branch is configured for Hostinger deployment from:

`awk-paid-courses-azadi-sale`

After the repository is present on Hostinger, run this from the repository root:

```bash
bash deploy.sh
```

That single command automatically:

- fetches the latest `origin/awk-paid-courses-azadi-sale` branch;
- force-aligns the deployment checkout with that remote branch;
- preserves ignored server-only files such as `.env`, `.deploy/`, `vendor/`, and generated `public_html/`;
- verifies PHP 8.2+ and Composer 2;
- installs production Composer dependencies;
- creates `.env` and the Laravel `APP_KEY` when needed;
- creates or repairs the MySQL database/user through the Hostinger API when needed;
- runs Laravel migrations and seeders;
- creates the generated Laravel public web root and publishes assets;
- creates the storage link;
- attempts to configure Laravel Scheduler on Hostinger;
- clears/rebuilds Laravel production caches;
- verifies important Laravel routes and database connectivity.

The repository may itself be checked out inside Hostinger's domain `public_html` directory. In that layout, the root `.htaccess` securely forwards public traffic to the generated Laravel `public_html/` child directory so framework/source files are not served directly.

### Existing Hostinger checkout that does not have `deploy.sh` yet

Use this one-time bootstrap command from the existing repository root:

```bash
git fetch origin +refs/heads/awk-paid-courses-azadi-sale:refs/remotes/origin/awk-paid-courses-azadi-sale && git checkout -f -B awk-paid-courses-azadi-sale origin/awk-paid-courses-azadi-sale && bash deploy.sh
```

After that, every future deployment is simply:

```bash
bash deploy.sh
```

On the first deployment, the script may securely ask for a Hostinger API token if it needs to create/recover database access. The token is not committed or written to `.env`. Existing valid database credentials are reused on later deployments.

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
