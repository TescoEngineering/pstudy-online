# PSTUDY – Google Cloud Speech-to-Text Setup

When **“Consider only deck answers”** is enabled in practice, PSTUDY can call **Google Cloud Speech-to-Text** for better recognition of short, domain-specific words (phrase hints from your deck). Otherwise the app uses the browser **Web Speech API**.

The code is already wired: `/api/speech-to-text`, `speech-cloud.ts`, and practice mode. You only need a **Google Cloud project**, **billing**, **API enabled**, and a **service account JSON** in environment variables.

---

## What you need in Google Cloud (checklist)

| Step | What |
|------|------|
| 1 | A **Google Cloud project** (top bar project selector) |
| 2 | A **billing account** linked to that project (required for Speech-to-Text, even for free-tier minutes) |
| 3 | **Speech-to-Text API** enabled for the project |
| 4 | A **service account** with the **Cloud Speech Client** role |
| 5 | A **JSON key** for that service account (downloaded once) — **never commit it to Git** |

Use **Service account JSON**, not an “OAuth client ID” for a web app. PSTUDY’s server uses the official `@google-cloud/speech` library with that JSON.

---

## Step 1 — Pick or create a project

1. Open **https://console.cloud.google.com**
2. In the **project dropdown** (top left), select an existing project or **New Project**
3. Note the **Project ID** (e.g. `my-pstudy-123`); it should match the `project_id` inside the JSON key later

---

## Step 2 — Link billing (often where people get stuck)

1. Go to **Billing** in the left menu (or **https://console.cloud.google.com/billing**)
2. **Link** a billing account to **this project**  
   - Speech-to-Text is billed after free monthly usage; Google still requires an active billing account on the project for this API
3. If your organization blocks billing, you’ll need an admin to enable it

---

## Step 3 — Enable Speech-to-Text API

1. Go to **APIs & Services** → **Library**  
   Or: **https://console.cloud.google.com/apis/library/speech.googleapis.com**
2. Search for **Speech-to-Text API** (Google Cloud Speech-to-Text)
3. Open it and click **Enable**
4. Wait until it shows **Enabled** for your project

---

## Step 4 — Create a service account and grant **Cloud Speech Client**

1. Go to **IAM & Admin** → **Service Accounts**  
   **https://console.cloud.google.com/iam-admin/serviceaccounts**
2. Click **Create service account**
3. **Name** e.g. `pstudy-speech` → **Create and continue**
4. Under **Grant this service account access to the project**:
   - Click **Select a role**
   - Search for **Cloud Speech Client** (API name: `roles/speech.client`)
   - Select **Cloud Speech Client** (not only “Viewer”)
5. **Continue** → **Done**

If you already created a service account without a role:

1. **IAM & Admin** → **IAM**
2. Find the principal (service account email ending in `@...iam.gserviceaccount.com`)
3. **Edit** (pencil) → **Add another role** → **Cloud Speech Client** → Save

---

## Step 5 — Create a JSON key

1. Open **IAM & Admin** → **Service Accounts** → click your service account
2. Tab **Keys** → **Add key** → **Create new key** → **JSON** → **Create**
3. A file downloads — store it **outside** the repo or in the project folder **only** if listed in `.gitignore` (e.g. `google-credentials.json`)

**Security:** Anyone with this file can use your project’s Speech API within IAM limits. Do not commit it; rotate the key if it leaks.

---

## Step 6 — Add credentials to PSTUDY

### Option A — Local development (file path)

1. Place the JSON in your project (e.g. `C:\pstudy-web\google-credentials.json`) — already ignored by `.gitignore` patterns
2. In **`.env.local`** (create from `.env.example` if needed):

```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

Use a **forward-slash** path or an absolute Windows path:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:/pstudy-web/google-credentials.json
```

3. Restart the dev server: `npm run dev`

Next.js loads `.env.local`; the Speech client reads the file from this path.

### Option B — Vercel / production (JSON as env var)

Servers have no local file, so paste the **entire JSON** into one variable:

1. Vercel → your project → **Settings** → **Environment Variables**
2. Add:

| Name | Value |
|------|--------|
| `GOOGLE_CLOUD_CREDENTIALS_JSON` | Paste the **full** JSON (one line is fine) |

3. Apply to **Production** (and Preview if you want)
4. **Redeploy**

Do **not** use `NEXT_PUBLIC_` for credentials — keep them server-only.

---

## Step 7 — Verify

1. **API check:** Open in the browser (while logged into your app if needed):  
   `http://localhost:3000/api/speech-to-text/status`  
   You should see: `{"available":true}`  
   If `false`, env vars are not loaded or the variable name is wrong.

2. **Practice:** Open a deck → practice → enable **Speak** and **Consider only deck answers** → speak.  
   If STT is configured, PSTUDY uses cloud recognition with phrase hints; otherwise it falls back to the browser.

---

## Cost (summary)

- Google publishes **monthly free usage** for Speech-to-Text; after that, usage is per audio duration  
- See current pricing: **https://cloud.google.com/speech-to-text/pricing**

---

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| `/api/speech-to-text/status` → `available: false` | Set `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_CLOUD_CREDENTIALS_JSON`; restart dev server or redeploy |
| “Google Cloud denied access…” / PERMISSION_DENIED | Enable **Speech-to-Text API**; add role **Cloud Speech Client** to the **service account** (not only your user login) |
| Billing / API disabled errors | Link **billing** to the project; enable the API in **Library** |
| “Invalid … credentials” | JSON truncated or wrong in Vercel; file path wrong locally; must be **service account** JSON |
| Empty transcript | Mic / browser permissions; speak during the 2s chunk; check browser records `audio/webm;codecs=opus` |
| Works locally but not on Vercel | Add `GOOGLE_CLOUD_CREDENTIALS_JSON` in Vercel env and redeploy |

---

## Reference — env vars

| Variable | Use |
|----------|-----|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service account `.json` file (local) |
| `GOOGLE_CLOUD_CREDENTIALS_JSON` | Full JSON string (e.g. Vercel) |

Only one approach is needed per environment.
