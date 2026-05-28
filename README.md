# Football Auction

Real-time football player auction system built with vanilla HTML, CSS, JavaScript, and Supabase.

## What This Project Does

This project helps run a live football player auction with two synchronized screens:

- an admin panel for the auction operator
- a live display screen for the audience, projector, or TV

The admin can load player sets, increase or decrease bids, mark players as sold or unsold, manage teams, and manage the player database. The display screen updates in real time to show the active player, current bid, sold/unsold states, and round progress.

## Features

- Live admin panel for controlling the auction
- Full-screen display screen for projector or TV view
- Real-time sync through Supabase
- Player CRUD management
- Team/franchise CRUD management
- Category and set-based auction flow
- Round 2 restart flow for unsold players
- Optional player image uploads using Supabase Storage

## Pages

- `index.html` - landing page
- `admin.html` - auction control panel
- `display.html` - live audience display

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- [Supabase](https://supabase.com/)

## Project Structure

```text
football auction/
|-- admin.html
|-- display.html
|-- index.html
|-- logo.png
|-- package.json
|-- README.md
|-- .env.example
|-- css/
|   `-- style.css
|-- js/
|   |-- admin.js
|   |-- app-config.js
|   |-- data.js
|   |-- display.js
|   `-- supabase-config.js
`-- scripts/
    `-- generate-config.js
```

`js/app-config.js` is generated locally from `.env` and should not be committed.

## Environment Variables

Create a `.env` file in the project root using `.env.example`.

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

Then generate the browser config file:

```bash
npm run generate-config
```

This command reads `.env` and creates `js/app-config.js`.

## How to Run

### 1. Create your environment file

Copy `.env.example` to `.env` and add your Supabase project values.

### 2. Generate the frontend config

Run:

```bash
npm run generate-config
```

This creates the local config file used by the browser.

### 3. Start a local server

Because this is a static frontend app, serve it with a local server instead of opening the HTML files directly.

```bash
python -m http.server 8000
```

### 4. Open the app

Open these pages in your browser:

- `http://localhost:8000/`
- `http://localhost:8000/admin.html`
- `http://localhost:8000/display.html`

## Supabase Requirements

This project expects:

- a `players` table
- a `teams` table
- an `auction_state` table
- a public storage bucket named `player-images`

## Suggested Database Schema

### `teams`

```sql
create table if not exists teams (
  id bigint generated always as identity primary key,
  name text not null,
  logo_url text
);
```

### `players`

```sql
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
```

### `auction_state`

```sql
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

## Notes

- `admin.html` is the operator view
- `display.html` is the fullscreen display view
- `js/data.js` contains the app data logic and default mock player seed list
- The Supabase anon key is a public client key, but it is still better not to hardcode it in the repository
