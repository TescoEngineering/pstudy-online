# PSTUDY – Supabase Setup Guide (Step-by-Step)

This guide walks you through adding a database and login to PSTUDY. No coding required for the setup steps—just follow along.

---

## Overview

We will:
1. Create a free Supabase account and project
2. Create the database tables
3. Add your secret keys to the project
4. Enable login (email + password)

---

## Step 1: Create a Supabase Account

1. Open your browser and go to **https://supabase.com**
2. Click **"Start your project"** (top right)
3. Sign up with **GitHub** (easiest) or with your email
4. Complete the sign-up if asked

---

## Step 2: Create a New Project

1. After logging in, you’ll see the Supabase dashboard
2. Click **"New Project"**
3. Fill in:
   - **Name:** `pstudy` (or any name you like)
   - **Database Password:** Create a strong password and **save it somewhere safe** (you’ll need it later)
   - **Region:** Choose the closest to you (e.g. `West EU (Ireland)` for Belgium)
4. Click **"Create new project"**
5. Wait 1–2 minutes for the project to be ready

---

## Step 3: Get Your Project URL and Key

1. In the left sidebar, click **"Project Settings"** (gear icon at the bottom)
2. Click **"API"** in the left menu
3. You’ll see:
   - **Project URL** – something like `https://xxxxxxxxxxxxx.supabase.co`
   - **Project API keys** – find the **anon public** key (a long string)

4. **Copy both** and keep them handy. You’ll need them in Step 6.

---

## Step 4: Create the Database Tables

1. In the left sidebar, click **"SQL Editor"**
2. Click the **+** button, then choose **Create a new snippet**
3. In the editor, **delete any existing text** and paste the SQL below (the full block)
4. Click **"Run"** (or press Ctrl+Enter)

```sql
-- PSTUDY database tables
-- Run this in Supabase SQL Editor

-- Decks table (one per user)
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled deck',
  is_public BOOLEAN DEFAULT false,
  field_of_interest TEXT,
  topic TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items table (one per deck item)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  multiplechoice1 TEXT DEFAULT '',
  multiplechoice2 TEXT DEFAULT '',
  multiplechoice3 TEXT DEFAULT '',
  multiplechoice4 TEXT DEFAULT '',
  picture_url TEXT DEFAULT '',
  instruction TEXT DEFAULT ''
);

-- Allow users to read/write only their own decks
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own decks"
  ON decks FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Allow users to read/write items in their own decks
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage items in own decks"
  ON items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM decks
      WHERE decks.id = items.deck_id
      AND decks.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decks
      WHERE decks.id = items.deck_id
      AND decks.owner_id = auth.uid()
    )
  );

-- Create indexes for faster lookups
CREATE INDEX idx_decks_owner ON decks(owner_id);
CREATE INDEX idx_items_deck ON items(deck_id);

-- Allow anyone to view public decks (for Community)
CREATE POLICY "Anyone can view public decks"
ON decks FOR SELECT
TO public
USING (is_public = true);
```

5. You should see **"Success. No rows returned"** – that’s correct.

---

## Step 4b: Create Storage Bucket for Item Pictures

1. In the left sidebar, click **Storage**
2. Click **New bucket**
3. Set:
   - **Name:** `item-pictures`
   - **Public bucket:** ON (so images can be displayed)
4. Click **Create bucket**
5. Go back to **SQL Editor**, click the **+** button, then choose **Create a new snippet**
6. Paste and run this SQL (creates upload/read policies):

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload item pictures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view item pictures (for display)
CREATE POLICY "Public read item pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'item-pictures');
```

7. You should see **Success. No rows returned**.

---

## Step 4c: Add Community Sharing (Optional)

If you want to use the Community feature (browse and copy shared decks), run this SQL:

```sql
-- Add is_public column to decks
ALTER TABLE decks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Allow anyone to view public decks
CREATE POLICY "Anyone can view public decks"
ON decks FOR SELECT
TO public
USING (is_public = true);
```

If you get an error that the policy already exists, you can skip that part.

---

## Step 4d: Add Deck Attributes for Search (Optional)

To filter Community decks by field of interest (Geography, History, Science, etc.) and topic, run:

```sql
ALTER TABLE decks ADD COLUMN IF NOT EXISTS field_of_interest TEXT;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS topic TEXT;
CREATE INDEX IF NOT EXISTS idx_decks_field ON decks(field_of_interest);
CREATE INDEX IF NOT EXISTS idx_decks_topic ON decks(topic);
```

---

## Step 5: Enable Email Sign-Up (Optional)

By default, Supabase allows sign-up. To customize:

1. Go to **Authentication** → **Providers** in the left sidebar
2. Click **"Email"**
3. Ensure **"Enable Email provider"** is ON
4. (Optional) Turn OFF **"Confirm email"** if you want to test without email verification for now

---

## Step 6: Add Your Keys to the Project

1. Open your project folder in Cursor: `pstudy-web`
2. In the root folder (`pstudy-web`), find the file **`.env.local`**
   - If it doesn’t exist, create it (right-click → New File → name it `.env.local`)
3. Open `.env.local` and add these lines (replace with your actual values):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Replace:
   - `https://xxxxxxxxxxxxx.supabase.co` with your **Project URL** from Step 3
   - `your-anon-key-here` with your **anon public** key from Step 3
5. Save the file

**Important:** Never commit `.env.local` to Git. It’s already in `.gitignore`.

---

## Step 7: Add Keys to Vercel (for the Online Version)

1. Go to **https://vercel.com** and open your PSTUDY project
2. Click **Settings** → **Environment Variables**
3. Add two variables:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Project URL (from Step 3) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon public key (from Step 3) |

4. For each, select **Production**, **Preview**, and **Development**
5. Click **Save**
6. Go to **Deployments** → click **⋯** on the latest → **Redeploy** (so the new variables are used)

---

## Step 8: Test Locally

1. In Cursor, open the terminal (View → Terminal)
2. Run:

```powershell
cd y:\PSTUDY\Cursor\pstudy-web
npm run dev
```

3. Open **http://localhost:3000** in your browser
4. Click **"Get started"** or **"Log in"**
5. Create an account with your email and a password
6. You should see the dashboard and be able to create decks

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| "Invalid API key" | Check that you copied the full URL and anon key, with no extra spaces |
| Can’t sign up | In Supabase: Authentication → Providers → Email → ensure it’s enabled |
| Decks don’t load | Check the browser console (F12 → Console) for errors |
| Build fails on Vercel | Ensure both env variables are set in Vercel Settings |
| Picture upload fails | Complete Step 4b: create the item-pictures bucket in Storage |

---

## Next Steps (After Setup)

Once this works:
- Your decks are stored in the database
- Each user sees only their own decks
- Data persists across devices and browsers

If you run into issues, share the error message and we can fix it.
