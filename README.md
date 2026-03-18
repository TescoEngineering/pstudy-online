# PSTUDY Web – Online SaaS version

A browser-based version of [PSTUDY](https://www.pstudy.be), built with Next.js. Study languages, vocabulary, or any subject with custom decks. Import your existing PSTUDY `.txt` files and practice with straight answer or multiple choice.

## Quick start

1. Install dependencies: `npm install`
2. Run dev server: `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000)

## Features

- **Dashboard**: Create and manage decks (stored in browser `localStorage` for now).
- **Deck editor**: Add/edit/remove items (description, explanation, 4 MC options, instruction).
- **Import**: Paste or upload a PSTUDY `.txt` file; supports both plain and obfuscated format from the desktop app.
- **Practice**: Straight answer or multiple choice, normal or random order; see score at the end.

## Adding a database and auth

The app currently uses `localStorage` so it works without a backend. To turn it into a real SaaS:

1. Add [Supabase](https://supabase.com) (or another DB): tables `users`, `decks`, `items`.
2. Add auth (e.g. [NextAuth.js](https://nextauth.js.org) or Supabase Auth).
3. Replace the `loadDecks` / `saveDecks` helpers in the app with API calls to your backend.

See the parent folder’s **PSTUDY-SaaS-PLAN.md** for the full conversion plan and data model.

## PSTUDY .txt format

Tab-separated, one line per item:

```
description \t explanation \t mc1 \t mc2 \t mc3 \t mc4 \t picture \t instruction
```

If the first line is `PSTUDYEXAMFILE`, the file is treated as an exam file (name only; items are still imported).
