# Diet Assistant Backend Contract

This repository is a static GitHub Pages site. Do not put `GROQ_API_KEY` or any other secret in the frontend. The frontend in `assistant.js` calls a separate backend that Claude can implement and deploy.

## Required Environment

- `GROQ_API_KEY`: secret server-side key only.
- `GROQ_CHAT_MODEL`: suggested default `llama-3.3-70b-versatile`; lighter fallback `llama-3.1-8b-instant`.
- `GROQ_TRANSCRIBE_MODEL`: suggested default `whisper-large-v3-turbo`.
- `ALLOWED_ORIGIN`: `https://byreddy1303.github.io`.

## CORS

Allow the GitHub Pages origin:

```http
Access-Control-Allow-Origin: https://byreddy1303.github.io
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Handle `OPTIONS` preflight for every endpoint.

## Endpoints

### `GET /api/health`

Used by the frontend Test button.

Response:

```json
{
  "ok": true,
  "service": "diet-assistant",
  "chatModel": "llama-3.3-70b-versatile",
  "transcribeModel": "whisper-large-v3-turbo"
}
```

### `POST /api/ask`

The frontend sends JSON.

Request:

```json
{
  "documentId": "suresh-sharma-family-diet-plan",
  "question": "I do not have bottle gourd today. What can I cook instead?",
  "language": "auto",
  "sourceUrl": "https://byreddy1303.github.io/Suresh_Sharma_Family_Diet_Plan/",
  "pageTitle": "Suresh Sharma Family Nutrition System ...",
  "selectedText": "",
  "currentSection": {
    "id": "s3",
    "heading": "03 7-Day Meal Plan ...",
    "textPreview": "short section preview from the page"
  },
  "answerMode": "practical_family_diet_assistant",
  "safety": {
    "doNotDiagnose": true,
    "doNotChangeMedication": true,
    "adviseDoctorForSymptomsOrMedicalRisk": true,
    "useDietPlanAsPrimaryReference": true
  }
}
```

Response:

```json
{
  "answer": "Plain text or markdown-style answer. Keep it warm, practical, and family-friendly.",
  "followUps": [
    "What can I cook with the vegetables I have?",
    "How much rice should Amma take tonight?"
  ]
}
```

Error response:

```json
{
  "error": {
    "message": "Human-readable error for the frontend"
  }
}
```

### `POST /api/transcribe`

The frontend sends `multipart/form-data`.

Fields:

- `audio`: voice recording blob, usually `diet-question.webm`.
- `documentId`: `suresh-sharma-family-diet-plan`.
- `language`: `auto`, `english`, `telugu`, or `hinglish`.
- `sourceUrl`: page URL.

Response:

```json
{
  "transcript": "Today instead of upma I ate two dosas. What should I do now?"
}
```

## Backend Knowledge Source

Use the diet plan as the main knowledge base. The simplest backend options are:

1. Keep a server-side copy of `family-diet-plan.html`, strip HTML to text once at startup, and pass relevant chunks to Groq.
2. Fetch the live page or GitHub raw file during build/deploy, strip HTML to text, and cache it.
3. Create a separate server-side text/markdown copy and update it whenever the plan changes.

Do not rely only on `currentSection.textPreview`; it is a convenience hint from the frontend, not the full knowledge base.

## Assistant Behavior

Use a system prompt like this:

```text
You are a friendly diet-plan assistant for Suresh Sharma's family.

You answer doubts about meals, substitutions, taste improvements, missed meals, cravings, travel food, timing, cooking methods, and practical family adjustments.

Use the Suresh Sharma Family Nutrition System as the primary reference. You may also use general safe cooking and nutrition knowledge for practical questions not directly answered in the plan.

Prefer Andhra Brahmin vegetarian home-food suggestions. No garlic. Onion is allowed. Keep suggestions practical for Kurnool/Andhra kitchens.

If a user ate something different today, do not scold them. Help them balance the next meal.

For diabetes, high BP, glaucoma, liver disease, surgery recovery, severe symptoms, medication questions, or emergency concerns, give cautious food guidance and advise speaking with the treating doctor. Do not diagnose, prescribe, or change medication.

Answer in the user's language when clear. If language is "auto", match the user's question. Keep the answer simple, warm, and actionable.
```

## Frontend Configuration

After the backend is deployed, open the live site and paste the backend base URL into the assistant panel, for example:

```text
https://your-project.vercel.app
```

The frontend stores it in browser `localStorage` as `dietAssistantApiBase`.

Optional hard-coded config can also be set before `assistant.js` loads:

```html
<script>
window.DIET_ASSISTANT_API_BASE = "https://your-project.vercel.app";
window.DIET_ASSISTANT_ENDPOINTS = {
  ask: "/api/ask",
  transcribe: "/api/transcribe",
  health: "/api/health"
};
</script>
```
