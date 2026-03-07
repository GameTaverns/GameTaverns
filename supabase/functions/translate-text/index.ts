import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory cache to avoid re-translating identical text+lang combos
const translationCache = new Map<string, string>();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, targetLanguage } = await req.json();

    if (!text || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: "Missing text or targetLanguage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't translate if target is English
    if (targetLanguage === "en") {
      return new Response(
        JSON.stringify({ translatedText: text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cacheKey = `${targetLanguage}:${text}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({ translatedText: cached }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const languageNames: Record<string, string> = {
      es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
      it: "Italian", ja: "Japanese", ko: "Korean", zh: "Chinese",
      ru: "Russian", sv: "Swedish", nl: "Dutch", pl: "Polish",
    };

    const langName = languageNames[targetLanguage] || targetLanguage;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a translator. Translate the following text to ${langName}. Return ONLY the translated text, nothing else. Preserve any formatting, links, or special characters.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ translatedText: text }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ translatedText: text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim() || text;

    // Cache the result
    translationCache.set(cacheKey, translatedText);

    return new Response(
      JSON.stringify({ translatedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translate-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
