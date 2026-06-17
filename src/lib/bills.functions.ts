import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BillingItemSchema = z.object({
  description: z.string(),
  code: z.string().optional().nullable(),
  amount: z.number(),
  flag: z
    .object({
      reason: z.string(),
      severity: z.enum(["info", "warning", "high"]),
    })
    .nullable()
    .optional(),
  cheaper_alternative: z
    .object({ name: z.string(), estimated_cost: z.number() })
    .nullable()
    .optional(),
});

const BillSchema = z.object({
  hospital_name: z.string().nullable(),
  total_amount: z.number().nullable(),
  plain_summary: z.string(),
  billing_items: z.array(BillingItemSchema),
  potential_savings: z.number().default(0),
});

export const parseBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileUrl: string; mimeType: string }) => input)
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are MediCura, an expert at decoding U.S. medical bills.
Read the attached bill (image or PDF) and respond with ONLY valid JSON matching this schema:
{
  "hospital_name": string | null,
  "total_amount": number | null,
  "plain_summary": string (2-3 sentences in friendly plain English),
  "billing_items": [
    {
      "description": string,
      "code": string | null (CPT / HCPCS code if present),
      "amount": number,
      "flag": null | { "reason": string (short why this is suspicious), "severity": "info" | "warning" | "high" },
      "cheaper_alternative": null | { "name": string, "estimated_cost": number }
    }
  ],
  "potential_savings": number (sum of expected savings)
}
Flag duplicate, vague, or unusually expensive line items. Do not invent codes you cannot read.`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Decode this bill and return the structured JSON only." },
            { type: "image_url", image_url: { url: data.fileUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Rate limit hit — try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted on this workspace.");
      throw new Error(`AI gateway error: ${res.status} ${txt}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: z.infer<typeof BillSchema>;
    try {
      parsed = BillSchema.parse(JSON.parse(content));
    } catch {
      // fallback minimal record if AI returned junk
      parsed = {
        hospital_name: null,
        total_amount: null,
        plain_summary: "We couldn't fully parse this bill. Please review manually.",
        billing_items: [],
        potential_savings: 0,
      };
    }

    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("bills")
      .insert({
        user_id: userId,
        original_file_url: data.fileUrl,
        hospital_name: parsed.hospital_name,
        total_amount: parsed.total_amount,
        plain_summary: parsed.plain_summary,
        billing_items: parsed.billing_items,
        potential_savings: parsed.potential_savings,
      })
      .select("id")
      .single();
    if (error) throw error;

    return { billId: row.id };
  });
