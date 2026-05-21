# `fit-coach` Edge Function

Conversational Coach: dialogisch Fit-Bewertungen aus dem User rausholen und als
strukturierte JSON-Ratings zurückgeben, die das Frontend direkt in
`user_shoe_fits` persistieren kann.

## Request

```json
{
  "intent": "extract",                              // optional, default "chat"
  "messages": [
    { "role": "user", "content": "Meine On Cloudmonster..." }
  ],
  "shoe_context": {                                 // optional
    "brand": "On",
    "model": "Cloudmonster",
    "size_eu": 44.5
  },
  "existing_ratings": [                             // optional
    { "dimension": "length", "rating": "perfect" }
  ]
}
```

## Response

```json
{
  "reply": "Klingt nach passender Länge. Spürst du an den Zehen seitlich Druck?",
  "proposed_ratings": [
    { "dimension": "length", "rating": "perfect" }
  ]
}
```

`proposed_ratings` fehlt wenn der Bot noch keine Bewertung extrahieren konnte.

## Modi

- **`chat`** (default): freier Dialog, Bot kann optional JSON-Block am Ende ausgeben.
- **`extract`**: Bot fragt aktiv die fehlenden Dimensionen ab, eine nach der anderen.

## Setup

1. **Secret**: `GROQ_API_KEY` als Supabase Edge-Function-Secret setzen.
   Optional: `GROQ_MODEL` (default `llama-3.3-70b-versatile`).
2. **Deploy**: Edge Functions → "Deploy a new function" → "Via Editor" →
   Name `fit-coach` → Inhalt von `index.ts` einfügen → Deploy.

## Frontend-Aufruf

```ts
const { data, error } = await supabase.functions.invoke("fit-coach", {
  body: {
    intent: "extract",
    messages: [...history, { role: "user", content: input }],
    shoe_context: { brand: "On", model: "Cloudmonster", size_eu: 44.5 },
    existing_ratings: alreadyRatedFromDb,
  },
});

if (data?.proposed_ratings) {
  // Direkt in user_shoe_fits upserten
  await supabase.from("user_shoe_fits").upsert(
    data.proposed_ratings.map((r) => ({
      user_shoe_id,
      dimension: r.dimension,
      rating: r.rating,
    })),
    { onConflict: "user_shoe_id,dimension" }
  );
}
```

## Schemas

### Fit-Dimensionen (7)

| Key | Label |
|---|---|
| `length` | Länge / Zehraum |
| `toebox_width` | Toebox-Breite |
| `forefoot_width` | Vorfuß-/Ballenbreite |
| `midfoot` | Mittelfuß / Spann |
| `heel` | Ferse |
| `drop` | Sprengung |
| `cushion` | Dämpfung |

### Fit-Ratings (5)

| Key | Label |
|---|---|
| `much_too_tight` | viel zu eng |
| `slightly_tight` | etwas zu eng |
| `perfect` | perfekt |
| `slightly_loose` | etwas zu weit |
| `much_too_loose` | viel zu weit |

## Limits

- 60 requests / IP / Stunde (in-memory pro Function-Instanz).
- Max 30 Messages im History-Window.
- Max 4000 Zeichen pro Message.
- Max 600 Tokens Output.
