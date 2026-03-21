# PSTUDY – Google Cloud Speech-to-Text Setup

When "Consider only deck answers" is enabled, PSTUDY can use **Google Cloud Speech-to-Text** for much better recognition of domain-specific words (e.g. musical notes do, re, mi, fa, sol, la, si). Phrase hints are sent so the engine biases toward your deck’s correct answers.

Without this setup, PSTUDY falls back to the browser’s Web Speech API, which is less accurate for short, domain-specific terms.

---

## Step 1: Create a Google Cloud Project

1. Go to **https://console.cloud.google.com**
2. Sign in with your Google account
3. Click the project dropdown (top left) → **New Project**
4. Name it (e.g. `pstudy`) and click **Create**
5. Select the new project

---

## Step 2: Enable Speech-to-Text API

1. Go to **APIs & Services** → **Library**
2. Search for **Speech-to-Text API**
3. Click it, then click **Enable**

---

## Step 3: Create a Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service account**
3. Name it (e.g. `pstudy-speech`) and click **Create and Continue**
4. Skip optional steps (roles) → **Done**
5. Click the new service account → **Keys**
6. **Add key** → **Create new key** → **JSON** → **Create**
7. Save the downloaded JSON file somewhere safe (e.g. `pstudy-web/google-credentials.json`)

**Important:** Do not commit this file to Git. Add it to `.gitignore`:

```
google-credentials.json
google-*.json
```

---

## Step 4: Add Credentials to Your Project

### Option A: Local development (file path)

1. Copy the JSON file into your project folder, or remember its path
2. Open **`.env.local`** (create it if needed)
3. Add:

```
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

Or use an absolute path:

```
GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\google-credentials.json
```

4. Restart the dev server (`npm run dev`)

### Option B: Vercel / production (JSON string)

Vercel can’t read local files, so you must pass the credentials as a JSON string:

1. Open the service account JSON file
2. Copy its **entire contents** (one line is fine)
3. Go to Vercel → your project → **Settings** → **Environment Variables**
4. Add:

| Name | Value |
|------|-------|
| `GOOGLE_CLOUD_CREDENTIALS_JSON` | Paste the full JSON (as a single-line string) |

5. Redeploy

---

## Step 5: Test

1. Start PSTUDY and open a practice session
2. Enable **Speak** and **Consider only deck answers**
3. Speak an answer from your deck (e.g. "sol" for a music deck)
4. Recognition should be noticeably better than the browser default

---

## Cost

- Google offers about **60 minutes/month free**
- After that: ~$0.006 per 15 seconds (~$1.44/hour)
- Typical usage: a few minutes per session

---

## Troubleshooting

| Issue | Possible fix |
|-------|--------------|
| "Speech-to-Text not configured" | Check that `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_CLOUD_CREDENTIALS_JSON` is set correctly |
| "Microphone access denied" | Allow mic access in the browser |
| Poor quality or errors | Ensure the Speech-to-Text API is enabled in the Google Cloud project |
| Encoding errors | Chrome should record WebM/Opus; if problems persist, check browser support |
