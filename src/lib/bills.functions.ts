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

const ExtractedMedicationSchema = z.object({
  medicationName: z.string(),
  dosage: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  quantity: z.string().nullable().optional(),
  suggestedTimes: z.array(z.string()).default([]),
});

const BillSchema = z.object({
  hospital_name: z.string().nullable(),
  total_amount: z.number().nullable(),
  currency: z.string().default("USD"),
  plain_summary: z.string(),
  billing_items: z.array(BillingItemSchema),
  potential_savings: z.number().default(0),
  extractedMedications: z.array(ExtractedMedicationSchema).default([]),
});


const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function normalizeTime(t: string): string | null {
  // Accept "HH:MM" or "HH:MM:SS" or "8:00 AM"
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

export const parseBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileUrl: string; mimeType: string }) => input)
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are MediCura, an expert at decoding medical bills from any country.
Read the attached bill (image or PDF) and respond with ONLY valid JSON matching this schema:
{
  "hospital_name": string | null,
  "total_amount": number | null,
  "currency": string (ISO 4217 code of the currency actually shown on the bill — e.g. "USD", "INR", "EUR", "GBP", "JPY", "AED". Infer from currency symbols (₹, $, €, £, ¥), words ("Rs.", "Rupees", "INR"), the country/hospital, or address. Default to "USD" only if truly unknown.),
  "plain_summary": string (2-3 sentences in friendly plain English),
  "billing_items": [
    {
      "description": string (preserve the wording from the bill),
      "code": string | null (CPT / HCPCS / local billing code if present),
      "amount": number (numeric value in the SAME currency as the bill — do NOT convert to USD),
      "flag": null | { "reason": string, "severity": "info" | "warning" | "high" },
      "cheaper_alternative": null | { "name": string, "estimated_cost": number (same currency as the bill) }
    }
  ],
  "potential_savings": number (same currency as the bill),
  "extractedMedications": [
    {
      "medicationName": string,
      "dosage": string | null (e.g. "500mg"),
      "frequency": string | null (e.g. "Twice daily"),
      "quantity": string | null (e.g. "30 pills"),
      "suggestedTimes": string[] (24-hour "HH:MM" strings, e.g. ["08:00","20:00"])
    }
  ]
}
IMPORTANT: Keep all monetary amounts in the bill's original currency — never convert. Include every line item exactly as it appears on the bill (don't omit, merge, or reorder). Flag duplicate, vague, or unusually expensive items. For every prescription medication on the bill, add it to extractedMedications with a reasonable dosing schedule. If no medications are present, return an empty array.`;


    const isPdf =
      data.mimeType === "application/pdf" || /\.pdf($|\?)/i.test(data.fileUrl);

    let userContent: Array<Record<string, unknown>>;
    if (isPdf) {
      const fileRes = await fetch(data.fileUrl);
      if (!fileRes.ok) throw new Error(`Could not download bill (${fileRes.status})`);
      const buf = new Uint8Array(await fileRes.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      userContent = [
        { type: "text", text: "Decode this PDF bill and return the structured JSON only." },
        {
          type: "file",
          file: {
            filename: "bill.pdf",
            file_data: `data:application/pdf;base64,${base64}`,
          },
        },
      ];
    } else {
      userContent = [
        { type: "text", text: "Decode this bill and return the structured JSON only." },
        { type: "image_url", image_url: { url: data.fileUrl } },
      ];
    }

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
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
      parsed = {
        hospital_name: null,
        total_amount: null,
        currency: "USD",
        plain_summary: "We couldn't fully parse this bill. Please review manually.",
        billing_items: [],
        potential_savings: 0,
        extractedMedications: [],
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
        currency: (parsed.currency || "USD").toUpperCase(),
        plain_summary: parsed.plain_summary,
        billing_items: parsed.billing_items as unknown as never,
        potential_savings: parsed.potential_savings,
      })

      .select("id")
      .single();
    if (error) throw error;

    // Auto-create reminders for each extracted medication.
    const reminderRows: Array<{
      user_id: string;
      medication_name: string;
      dosage: string | null;
      schedule_time: string;
      days_of_week: string[];
      active: boolean;
    }> = [];
    for (const med of parsed.extractedMedications) {
      const times = (med.suggestedTimes && med.suggestedTimes.length > 0
        ? med.suggestedTimes
        : ["08:00"]
      )
        .map(normalizeTime)
        .filter((t): t is string => !!t);
      for (const t of times) {
        reminderRows.push({
          user_id: userId,
          medication_name: med.medicationName,
          dosage: [med.dosage, med.frequency, med.quantity].filter(Boolean).join(" · ") || null,
          schedule_time: t,
          days_of_week: ALL_DAYS,
          active: true,
        });
      }
    }

    if (reminderRows.length > 0) {
      // best-effort; don't fail the whole parse if this insert errors
      await supabase.from("reminders").insert(reminderRows);
    }

    return { billId: row.id, remindersCreated: reminderRows.length };
  });
