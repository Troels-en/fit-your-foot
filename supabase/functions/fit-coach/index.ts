// Supabase Edge Function: fit-coach
//
// Conversational Coach für die Profil-Schuh-Sammlung. Holt fehlende Fit-Bewertungen
// dialogisch aus dem User raus und gibt am Ende strukturierte Ratings zurück, die
// das Frontend direkt in user_shoe_fits persistieren kann.
//
// Modi:
//   - intent: "chat"     → freier Dialog (default)
//   - intent: "extract"  → Bot soll konkret nachfragen für die 7 Dimensionen,
//                          und sobald genug Info da ist, JSON mit Ratings senden.
//
// Request:
//   {
//     intent?: "chat" | "extract",
//     messages: [{ role: "user" | "assistant", content: string }, ...],
//     shoe_context?: { brand?: string, model?: string, size_eu?: number },
//     existing_ratings?: { dimension: FitDimension, rating: FitRating }[]
//   }
//
// Response:
//   {
//     reply: string,                   // Bot-Antwort als Text
//     proposed_ratings?: [{ dimension: FitDimension, rating: FitRating }]
//   }
//
// Env:
//   GROQ_API_KEY  ← Pflicht
//   GROQ_MODEL    ← optional, default "llama-3.3-70b-versatile"

const RATE_LIMIT_PER_HOUR = 60; // grosszügig — Chat braucht oft viele Turns

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ---------- Schemas ----------
const FIT_DIMENSIONS = [
  "length",
  "toebox_width",
  "forefoot_width",
  "midfoot",
  "heel",
  "drop",
  "cushion",
] as const;
type FitDimension = (typeof FIT_DIMENSIONS)[number];

const FIT_RATINGS = [
  "much_too_tight",
  "slightly_tight",
  "perfect",
  "slightly_loose",
  "much_too_loose",
] as const;
type FitRating = (typeof FIT_RATINGS)[number];

const DIMENSION_LABELS: Record<FitDimension, string> = {
  length: "Länge / Zehraum (vorne)",
  toebox_width: "Toebox-Breite (an den Zehen)",
  forefoot_width: "Vorfuß-/Ballenbreite",
  midfoot: "Mittelfuß / Spann (Schnürbereich)",
  heel: "Ferse (Halt)",
  drop: "Sprengung (Heel-Drop-Empfinden)",
  cushion: "Dämpfung / Stack",
};

const RATING_LABELS: Record<FitRating, string> = {
  much_too_tight: "viel zu eng",
  slightly_tight: "etwas zu eng",
  perfect: "perfekt",
  slightly_loose: "etwas zu weit",
  much_too_loose: "viel zu weit",
};

// ---------- System Prompt ----------
const buildSystemPrompt = (
  intent: "chat" | "extract",
  shoeContext: { brand?: string; model?: string; size_eu?: number } | undefined,
  existingRatings: { dimension: FitDimension; rating: FitRating }[] | undefined
): string => {
  const shoeLine = shoeContext
    ? `Aktueller Schuh: ${shoeContext.brand ?? "?"} ${shoeContext.model ?? "?"}${
        shoeContext.size_eu ? ` (EU ${shoeContext.size_eu})` : ""
      }.`
    : "Noch kein Schuh ausgewählt.";

  const alreadyRated = existingRatings?.length
    ? `Bereits bewertet:\n${existingRatings
        .map(
          (r) =>
            `- ${DIMENSION_LABELS[r.dimension]}: ${RATING_LABELS[r.rating]}`
        )
        .join("\n")}`
    : "Noch keine Dimension bewertet.";

  const missing = existingRatings
    ? FIT_DIMENSIONS.filter(
        (d) => !existingRatings.some((r) => r.dimension === d)
      )
    : FIT_DIMENSIONS;

  const missingLine = missing.length
    ? `Fehlende Dimensionen: ${missing.map((d) => DIMENSION_LABELS[d]).join(", ")}.`
    : "Alle 7 Dimensionen sind bereits bewertet.";

  const base = `Du bist Fitly Fit-Coach — ein freundlicher, knapper Schuh-Berater. Du sprichst Deutsch (Du-Form). Antworten sind 1–3 Sätze, niemals länger.

${shoeLine}
${alreadyRated}
${missingLine}

Die 7 Fit-Dimensionen:
${FIT_DIMENSIONS.map((d) => `- ${d}: ${DIMENSION_LABELS[d]}`).join("\n")}

Mögliche Ratings (genau diese Strings verwenden):
${FIT_RATINGS.map((r) => `- ${r} = ${RATING_LABELS[r]}`).join("\n")}`;

  if (intent === "extract") {
    return `${base}

Aufgabe: Frag den User dimensionsweise ab, eine Dimension nach der anderen. Stelle konkrete, alltagstaugliche Fragen (nicht "wie ist die Toebox-Breite?", sondern "Hast du an der breitesten Stelle vorm Zeh Druck?"). Akzeptiere auch indirekte Antworten ("alles top", "vorne quetscht's") und übersetze sie in Ratings.

Wenn du dir bei einer Dimension sicher bist (oder der User explizit eine Bewertung gegeben hat), schreib am ENDE deiner Antwort genau einen JSON-Block in dieser Form:

\`\`\`json
{"proposed_ratings": [{"dimension": "length", "rating": "perfect"}]}
\`\`\`

Mehrere Dimensionen darfst du in einem Block bündeln. Verwende AUSSCHLIESSLICH die Strings aus der Liste oben. Wenn du noch keine Bewertung extrahieren kannst, gib KEINEN JSON-Block aus.`;
  }

  return `${base}

Aufgabe: Beantworte die Frage des Users zum Schuh-Fit. Bleib hilfreich und konkret. Wenn der User dir Fit-Probleme schildert, gib einen JSON-Block mit den abgeleiteten Ratings am Ende deiner Antwort aus (gleiches Format wie oben).`;
};

const getClientIp = (req: Request): string | null => {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null;
};

// In-Memory-Counter pro Edge-Function-Instanz (nicht perfekt, aber genügt um
// einzelne IPs zu drosseln; Produktions-RL würde Postgres oder Redis brauchen).
const recentByIp = new Map<string, number[]>();
const checkRate = (ip: string | null): boolean => {
  if (!ip) return true;
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  const arr = (recentByIp.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_PER_HOUR) return false;
  arr.push(now);
  recentByIp.set(ip, arr);
  return true;
};

// ---------- Extraction aus Bot-Output ----------
const extractRatingsBlock = (
  text: string
): { dimension: FitDimension; rating: FitRating }[] | null => {
  const match = text.match(/```json\s*([\s\S]+?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    const arr = parsed?.proposed_ratings;
    if (!Array.isArray(arr)) return null;
    const out: { dimension: FitDimension; rating: FitRating }[] = [];
    for (const item of arr) {
      const d = item?.dimension;
      const r = item?.rating;
      if (
        FIT_DIMENSIONS.includes(d as FitDimension) &&
        FIT_RATINGS.includes(r as FitRating)
      ) {
        out.push({ dimension: d, rating: r });
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
};

const stripJsonBlock = (text: string): string =>
  text.replace(/```json\s*[\s\S]+?```/g, "").trim();

// ---------- Main handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (!groqKey) {
    console.error("GROQ_API_KEY missing");
    return json({ error: "Chat-Service nicht konfiguriert" }, 500);
  }

  const ip = getClientIp(req);
  if (!checkRate(ip)) {
    return json({ error: "Zu viele Anfragen — bitte kurz warten." }, 429);
  }

  // Body-size cap: lese als Text, dann parse — verhindert oversized Payloads
  const MAX_BODY_BYTES = 64_000;
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return json({ error: "Body konnte nicht gelesen werden" }, 400);
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return json({ error: "Request-Body zu groß" }, 413);
  }

  let payload: {
    intent?: "chat" | "extract";
    messages?: { role: string; content: string }[];
    shoe_context?: { brand?: string; model?: string; size_eu?: number };
    existing_ratings?: { dimension: FitDimension; rating: FitRating }[];
  };
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return json({ error: "Ungültiger Request-Body" }, 400);
  }

  const intent = payload.intent ?? "chat";
  const messages = payload.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages fehlt" }, 400);
  }

  // Sanitize shoe_context: max 150 chars, strip control chars
  const sanitizeShortString = (v: unknown): string | undefined => {
    if (typeof v !== "string") return undefined;
    // eslint-disable-next-line no-control-regex
    const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 150);
    return cleaned.length > 0 ? cleaned : undefined;
  };
  const sanitizedShoeContext = payload.shoe_context
    ? {
        brand: sanitizeShortString(payload.shoe_context.brand),
        model: sanitizeShortString(payload.shoe_context.model),
        size_eu:
          typeof payload.shoe_context.size_eu === "number" &&
          Number.isFinite(payload.shoe_context.size_eu) &&
          payload.shoe_context.size_eu >= 10 &&
          payload.shoe_context.size_eu <= 60
            ? payload.shoe_context.size_eu
            : undefined,
      }
    : undefined;

  // Bound existing_ratings to FIT_DIMENSIONS.length (7), only valid entries
  const sanitizedExistingRatings = Array.isArray(payload.existing_ratings)
    ? payload.existing_ratings
        .filter(
          (r) =>
            r &&
            FIT_DIMENSIONS.includes(r.dimension as FitDimension) &&
            FIT_RATINGS.includes(r.rating as FitRating)
        )
        .slice(0, FIT_DIMENSIONS.length)
    : undefined;

  // Sanitize messages: nur user/assistant durchlassen, content-Length begrenzen
  const cleanedMessages = messages
    .filter(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.length > 0
    )
    .slice(-30) // max 30 Turns
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 4000),
    }));

  if (cleanedMessages.length === 0) {
    return json({ error: "Keine gültige Message" }, 400);
  }

  const systemPrompt = buildSystemPrompt(
    intent,
    sanitizedShoeContext,
    sanitizedExistingRatings
  );
  const model = Deno.env.get("GROQ_MODEL") ?? "llama-3.3-70b-versatile";

  const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 600,
      messages: [{ role: "system", content: systemPrompt }, ...cleanedMessages],
    }),
  });

  if (!groqResp.ok) {
    const errText = await groqResp.text();
    console.error("Groq error", groqResp.status, errText);
    return json({ error: "Chat-Service antwortet nicht" }, 502);
  }

  const data = await groqResp.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  const proposed = extractRatingsBlock(raw);
  const reply = stripJsonBlock(raw) || "…";

  return json({
    reply,
    ...(proposed ? { proposed_ratings: proposed } : {}),
  });
});
