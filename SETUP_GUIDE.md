# Setup Guide (Non-Technical)

Follow these steps in order. Do one step fully before starting the next.

You need a Mac (this project is set up for macOS).

---

## What you will end up with

1. The **website** running on your computer  
2. The **backend database** running on your computer (local copy; DigitalOcean comes later)

Demo login password for all seeded accounts: **`demo1234`**

---

## Part A — Install the tools (one-time)

### Step 1: Install Homebrew (package helper)

1. Open **Terminal** (press `Cmd + Space`, type `Terminal`, press Enter).
2. Paste this, then press Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

3. If it asks for your Mac password, type it (you will not see characters) and press Enter.
4. When it finishes, if it shows “Next steps” commands, paste and run those too.

### Step 2: Install Docker Desktop

1. In Terminal, paste:

```bash
brew install --cask docker
```

2. When finished, open **Docker** from Applications (or Spotlight: `Cmd + Space` → `Docker`).
3. Click through the welcome screens / permissions if asked.
4. Wait until the whale icon in the menu bar says Docker is **running**.  
   Do not continue until Docker is fully started.

### Step 3: Install Node.js (runs the website)

In Terminal:

```bash
brew install node
```

### Step 4: Install the Supabase CLI (runs the local backend)

In Terminal:

```bash
brew install supabase/tap/supabase
```

### Step 5: Install project dependencies

1. In Terminal, go to the website folder:

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll/web"
```

2. Install packages:

```bash
npm install
```

Wait until it finishes without big red errors.

---

## Part B — Start the local backend (database)

### Step 6: Make sure Docker is running

Confirm the Docker whale icon is running in the menu bar.

### Step 7: Start Supabase

In Terminal:

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll"
supabase start
```

The first run can take several minutes (it downloads containers).

When it finishes, it prints URLs and keys. Keep that Terminal window available, or run:

```bash
supabase status
```

You need two values from the output:

- **API URL** (usually `http://127.0.0.1:54321`)
- **anon key** (a long string)

### Step 8: Load the Phase 1 database + demo data

In Terminal:

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll"
supabase db reset
```

This creates the tables and loads demo users / sample payroll data.

---

## Part C — Connect the website to the local backend

### Step 9: Create the website env file

1. Go to the `web` folder:

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll/web"
```

2. Copy the example env file:

```bash
cp .env.example .env.local
```

3. Open `.env.local` in a text editor (TextEdit, VS Code, or Cursor).
4. Set it like this.

Prefer the **anon** / JWT key from `supabase status` (long string starting with `eyJ...`).
You can also use **Publishable** if that is what your status screen shows.
Also copy the **service_role** key for admin “Create user”.

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-your-anon-or-publishable-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-your-service-role-key-here
```

5. Save the file.

---

## Part D — Run the website

### Step 10: Start the website

In Terminal:

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll/web"
npm run dev
```

Leave this Terminal window open while you use the site.

### Step 11: Open the app

In your browser go to:

[http://localhost:3000](http://localhost:3000)

### Step 12: Log in (demo)

Use any seeded email, for example:

- Super Admin: `alex@ballotaccesspros.com`
- Petitioner: `jordan@ballotaccesspros.com`

Password for all: **`demo1234`**

> Login now uses real local Supabase Auth. Demo password is still **`demo1234`**.
> Screens still show sample payroll data until we wire each page to the database.

---

## Everyday use (after the one-time install)

Each time you want to work:

1. Open **Docker Desktop** and wait until it is running.
2. Start the backend:

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll"
supabase start
```

3. Start the website:

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll/web"
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

When done:

- Stop the website: in that Terminal window press `Ctrl + C`
- Optional: stop backend with `supabase stop`

---

## Reset everything (if something looks broken)

```bash
cd "/Users/macpro/Projects/Ballot Access Pros Payroll"
supabase db reset
```

This wipes local demo data and reloads it fresh. It does **not** affect DigitalOcean (that comes later).

---

## When the client gives DigitalOcean access

You do **not** redo this guide from scratch.

A developer will:

1. Install the same database on DigitalOcean
2. Put the DigitalOcean URL + keys into Vercel
3. Keep using this same app

Local setup stays useful for testing.

---

## Common problems

| Problem | What to try |
|---|---|
| `supabase start` fails | Open Docker Desktop first and wait until it fully starts |
| Website won’t open | Confirm `npm run dev` is still running, then visit `http://localhost:3000` |
| Env / login weirdness | Recheck `.env.local` URL and anon key from `supabase status` |
| Command not found | Close Terminal, open a new window, try again (PATH not refreshed) |
| Permission / password prompts | That’s normal on Mac for installers |
| Seed error about `seed_user` / function does not exist | Already fixed in the project — rerun `supabase db reset` |

---

## Who to ask for help

If a step fails, send:

1. Which **Step number** you were on  
2. A screenshot of the Terminal error  
3. Whether Docker shows as **running**
