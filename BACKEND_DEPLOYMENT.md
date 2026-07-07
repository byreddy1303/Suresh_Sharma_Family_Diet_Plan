# Deploying the Diet Assistant Backend

The backend is ready for Vercel-style serverless deployment. The frontend on GitHub Pages will call this backend after you paste the deployed URL into the assistant panel.

## 1. Rotate the Exposed Key

The key pasted into chat should be considered exposed. Revoke it in Groq and create a fresh key before deployment.

## 2. Deploy to Vercel

Recommended path:

1. Import this GitHub repository into Vercel.
2. Use the default project settings.
3. Provision Neon Postgres via **Vercel Marketplace → Storage → Neon** and copy the pooled `DATABASE_URL` into project env vars.
4. Add these environment variables in Vercel Project Settings:

```text
GROQ_API_KEY=your_new_groq_key
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
GROQ_TRANSCRIBE_MODEL=whisper-large-v3-turbo
ALLOWED_ORIGIN=https://byreddy1303.github.io
DATABASE_URL=postgres://...neon...  # pooled connection from Neon
FAMILY_ADMIN_PASSCODE=choose-a-simple-family-code
```

5. Deploy.

The backend endpoints will be:

```text
https://your-vercel-project.vercel.app/api/health
https://your-vercel-project.vercel.app/api/ask
https://your-vercel-project.vercel.app/api/transcribe
https://your-vercel-project.vercel.app/api/health-profile
https://your-vercel-project.vercel.app/api/health-profile/unlock
https://your-vercel-project.vercel.app/api/plan-preview
https://your-vercel-project.vercel.app/api/plan-preview/apply
```

The Health Center schema (`family_members`, `health_entries`, `active_preview`) is created on the first call — no separate migration step. Default family members (Suresh, Veni, Susheel, Karthik) are seeded automatically.

## 3. Connect the Live Site

Open the GitHub Pages site:

```text
https://byreddy1303.github.io/Suresh_Sharma_Family_Diet_Plan/
```

Click **Ask Diet Doubts**, paste the Vercel base URL, and press **Save backend**:

```text
https://your-vercel-project.vercel.app
```

Then press **Test**. If `/api/health` passes, text and voice questions are ready.

## What the Backend Does

- Loads `family-diet-plan.html` server-side.
- Strips HTML into clean text.
- Splits the plan into searchable chunks.
- Retrieves only the most relevant chunks for each question.
- Calls Groq chat with the family-safe diet assistant prompt.
- Transcribes voice through Groq Whisper and sends the transcript back to the frontend.
- Stores per-member health entries in Neon Postgres behind a shared passcode, generates rule-based diet adjustments, and lets the family apply them as extra context on future assistant answers.

This keeps calls smaller and faster than sending the whole document every time, while still grounding answers in the plan.

## Health Center Safety

- Recommendations are produced by a deterministic rule engine (`api/_lib/health-rules.js`). The LLM is never asked to invent thresholds.
- Severe readings or warning notes force `doctorReviewRequired: true` and surface a red banner in the Health Center UI.
- The Groq assistant only sees health context after the family clicks **Send to assistant** in the Health Center. Passcode reads never leave the browser tab.
- Never store or transmit medication changes through this system.
