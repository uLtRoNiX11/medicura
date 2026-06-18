import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AlternativeMatch = {
  name: string;
  source: "database" | "ai";
  generic_equivalent: string | null;
  cheaper_alternative: string | null;
  average_cost: number | null;
  alternative_cost: number | null;
  savings_note?: string | null;
};

const AiSchema = z.object({
  generic_equivalent: z.string().nullable(),
  cheaper_alternative: z.string().nullable(),
  estimated_brand_cost: z.number().nullable(),
  estimated_generic_cost: z.number().nullable(),
  savings_note: z.string().nullable(),
});

export const findAlternatives = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { medicationNames: string[] }) => input)
  .handler(async ({ data, context }): Promise<AlternativeMatch[]> => {
    const { supabase } = context;
    const names = Array.from(
      new Set(data.medicationNames.map((n) => n.trim()).filter(Boolean)),
    );
    if (names.length === 0) return [];

    const results: AlternativeMatch[] = [];

    for (const name of names) {
      // 1) Try the reference dataset via case-insensitive partial match
      const { data: rows } = await supabase
        .from("medications")
        .select("*")
        .or(`name.ilike.%${name}%,generic_equivalent.ilike.%${name}%`)
        .limit(1);

      if (rows && rows.length > 0) {
        const m = rows[0];
        results.push({
          name,
          source: "database",
          generic_equivalent: m.generic_equivalent,
          cheaper_alternative: m.cheaper_alternative,
          average_cost: m.average_cost,
          alternative_cost: m.alternative_cost,
        });
        continue;
      }

      // 2) Fallback: ask the LLM for a generic equivalent
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) continue;

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a pharmacy savings assistant. For a given U.S. medication, reply with ONLY JSON:
{
  "generic_equivalent": string | null (the FDA-approved generic name),
  "cheaper_alternative": string | null (a commonly cheaper equivalent if different from generic),
  "estimated_brand_cost": number | null (USD for a typical 30-day supply),
  "estimated_generic_cost": number | null (USD for a typical 30-day supply),
  "savings_note": string | null (one short sentence on the savings opportunity)
}
If you are not confident, set fields to null. Do not invent prices.`,
              },
              { role: "user", content: `Medication: ${name}` },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (!aiRes.ok) continue;
        const j = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const parsed = AiSchema.safeParse(JSON.parse(j.choices?.[0]?.message?.content ?? "{}"));
        if (!parsed.success) continue;
        const p = parsed.data;
        if (!p.generic_equivalent && !p.cheaper_alternative) continue;
        results.push({
          name,
          source: "ai",
          generic_equivalent: p.generic_equivalent,
          cheaper_alternative: p.cheaper_alternative,
          average_cost: p.estimated_brand_cost,
          alternative_cost: p.estimated_generic_cost,
          savings_note: p.savings_note,
        });
      } catch {
        // ignore — best effort
      }
    }

    return results;
  });
