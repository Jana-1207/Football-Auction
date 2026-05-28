# Football Auction

Real-time football player auction system with:

- `admin.html` for the auction operator
- `display.html` for the live projector/screen view
- Supabase for database, storage, and realtime sync

## Project Overview

This repository is a static frontend app that uses the Supabase JavaScript CDN client.

The app supports:

- loading category/set-based player queues
- live bid increments and decrements
- marking players as sold or unsold
- automatic round progression
- a Round 2 flow for unsold players
- player CRUD management
- team/franchise CRUD management
- realtime sync between admin and display screens
- optional player photo uploads to Supabase Storage

## Project Structure

```text
.
|-- admin.html
|-- display.html
|-- index.html
|-- logo.png
|-- css/
|   `-- style.css
|-- js/
|   |-- admin.js
|   |-- app-config.js        # generated from .env, not committed
|   |-- data.js
|   |-- display.js
|   `-- supabase-config.js
`-- scripts/
    `-- generate-config.js
```

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- [Supabase](https://supabase.com/) for:
  - Postgres tables
  - realtime subscriptions
  - storage bucket for player images

## Environment Setup

The Supabase URL and anon key are no longer hardcoded in source files.

1. Copy `.env.example` to `.env`
2. Fill in your real Supabase values
3. Generate the browser config file:

```bash
npm run generate-config
```

This creates `js/app-config.js`, which is ignored by Git.

Required variables:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Running Locally

Because this is a static app, serve the folder with a local web server instead of opening the HTML files directly.

Example with Python:

```bash
python -m http.server 8000
```

Then open:

- `http://localhost:8000/`
- `http://localhost:8000/admin.html`
- `http://localhost:8000/display.html`

Before starting, make sure you have already run:

```bash
npm run generate-config
```

## Supabase Requirements

The app expects these tables:

### `players`

Suggested columns:

- `id` bigint primary key generated always as identity
- `name` text not null
- `position` text
- `club` text
- `nationality` text
- `photo_url` text
- `base_price` numeric not null
- `current_price` numeric not null
- `status` text not null default `'pending'`
- `round` integer not null default `1`
- `category` text not null
- `set_number` integer not null default `1`
- `sort_order` integer
- `team_id` bigint null

### `teams`

Suggested columns:

- `id` bigint primary key generated always as identity
- `name` text not null
- `logo_url` text

### `auction_state`

Suggested columns:

- `id` integer primary key
- `current_player_id` bigint null
- `active_category` text
- `active_set` integer
- `round` integer
- `last_action` text
- `updated_at` timestamptz default now()

### Storage bucket

Create a public storage bucket named:

```text
player-images
```

## Example Schema

```sql
create table if not exists teams (
  id bigint generated always as identity primary key,
  name text not null,
  logo_url text
);

create table if not exists players (
  id bigint generated always as identity primary key,
  name text not null,
  position text,
  club text,
  nationality text,
  photo_url text,
  base_price numeric not null,
  current_price numeric not null,
  status text not null default 'pending',
  round integer not null default 1,
  category text not null,
  set_number integer not null default 1,
  sort_order integer,
  team_id bigint references teams(id) on delete set null
);

create table if not exists auction_state (
  id integer primary key,
  current_player_id bigint references players(id) on delete set null,
  active_category text,
  active_set integer,
  round integer,
  last_action text,
  updated_at timestamptz default now()
);

insert into auction_state (
  id,
  current_player_id,
  active_category,
  active_set,
  round,
  last_action
)
values (1, null, 'Forwards', 1, 1, 'init')
on conflict (id) do nothing;
```

## GitHub Push Checklist

Before pushing:

1. Confirm `.env` is present locally
2. Run `npm run generate-config`
3. Verify `.env` and `js/app-config.js` are not staged
4. Push the remaining source files

## Notes

- `js/data.js` contains a default mock player seed list used by the app logic.
- `admin.html` is the operational control surface.
- `display.html` is optimized for fullscreen live display.
- The Supabase anon key is still a public browser key by design, but it should not be hardcoded in tracked source.

## Recommended Next Improvements

- add SQL migration files to the repo
- add a small local server script for one-command startup
- add Supabase RLS policies documentation
- normalize some text encoding issues visible in a few files
