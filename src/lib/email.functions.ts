import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatCurrency } from "@/lib/currency";

export type EmailDraft = {
  to: string;
  subject: string;
  body: string;
};

/**
 * Returns the draft text we'd send so the client can fall back to mailto:
 * or copy-to-clipboard if Resend itself fails or isn't configured.
 */
export const buildBillingReviewDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      billId: string;
      hospitalEmail: string;
      hospitalName: string;
      userQuestions?: string;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<EmailDraft> => {
    const { supabase, userId } = context;
    const { data: bill, error } = await supabase
      .from("bills")
      .select("*")
      .eq("id", data.billId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!bill) throw new Error("Bill not found");

    const items =
      (bill.billing_items as Array<{ description: string; amount: number; code?: string | null; flag?: unknown }>) || [];
    const currency = (bill.currency || "USD").toUpperCase();
    const flagged = items.filter((i) => i && i.flag);
    const itemList = items
      .map((i) => `- ${i.description}${i.code ? ` (code ${i.code})` : ""}: ${formatCurrency(i.amount, currency)}`)
      .join("\n");

    const subject = `Line-item review request — bill from ${data.hospitalName || "your facility"}`;
    const body = `Hello ${data.hospitalName || "Billing team"},

I'm reaching out to request a line-item review of a recent bill on my account, with the help of MediCura.

Total charged: ${formatCurrency(bill.total_amount ?? 0, currency)}

Charges I'd like to verify:
${itemList || "(no parsed line items)"}

${flagged.length ? `Items I'd especially appreciate clarification on:\n${flagged.map((f) => `- ${f.description}`).join("\n")}\n\n` : ""}${
      data.userQuestions ? `Additional questions:\n${data.userQuestions}\n\n` : ""
    }Could you please confirm each line, the corresponding codes, and any duplicate or pricing concerns?

Thank you for your help.`;

    return { to: data.hospitalEmail, subject, body };
  });

export const sendBillingReviewEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      billId: string;
      hospitalEmail: string;
      hospitalName: string;
      userQuestions?: string;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; reason: string; draft: EmailDraft }> => {
    const { supabase, userId } = context;
    const { data: bill, error } = await supabase
      .from("bills")
      .select("*")
      .eq("id", data.billId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!bill) throw new Error("Bill not found");

    const items =
      (bill.billing_items as Array<{ description: string; amount: number; code?: string | null; flag?: unknown }>) || [];
    const currency = (bill.currency || "USD").toUpperCase();
    const flagged = items.filter((i) => i && i.flag);
    const itemList = items
      .map((i) => `- ${i.description}${i.code ? ` (code ${i.code})` : ""}: ${formatCurrency(i.amount, currency)}`)
      .join("\n");

    const subject = `Line-item review request — bill from ${data.hospitalName || "your facility"}`;
    const body = `Hello ${data.hospitalName || "Billing team"},

I'm reaching out to request a line-item review of a recent bill on my account, with the help of MediCura.

Total charged: ${formatCurrency(bill.total_amount ?? 0, currency)}

Charges I'd like to verify:
${itemList || "(no parsed line items)"}

${flagged.length ? `Items I'd especially appreciate clarification on:\n${flagged.map((f) => `- ${f.description}`).join("\n")}\n\n` : ""}${
      data.userQuestions ? `Additional questions:\n${data.userQuestions}\n\n` : ""
    }Could you please confirm each line, the corresponding codes, and any duplicate or pricing concerns?

Thank you for your help.`;

    const draft: EmailDraft = { to: data.hospitalEmail, subject, body };
    const connectionKey = process.env.RESEND_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    if (!connectionKey || !lovableKey) {
      console.warn("[MediCura] Resend connector keys missing — returning draft for client-side fallback.");
      return { ok: false, reason: "Email service is not configured.", draft };
    }

    const fromAddr = process.env.RESEND_FROM_EMAIL || "MediCura <onboarding@resend.dev>";

    try {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connectionKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [data.hospitalEmail],
          subject,
          text: body,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.warn(`[MediCura] Resend send failed (${res.status}): ${txt}`);
        return { ok: false, reason: `Email provider error (${res.status}).`, draft };
      }

      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown email error";
      console.warn(`[MediCura] Resend threw: ${msg}`);
      return { ok: false, reason: msg, draft };
    }
  });
