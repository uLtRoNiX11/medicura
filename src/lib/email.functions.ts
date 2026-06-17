import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: bill, error } = await supabase
      .from("bills")
      .select("*")
      .eq("id", data.billId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!bill) throw new Error("Bill not found");

    const items = (bill.billing_items as Array<{ description: string; amount: number; code?: string | null }>) || [];
    const flagged = items.filter((i) => i && (i as { flag?: unknown }).flag);
    const itemList = items
      .map((i) => `- ${i.description}${i.code ? ` (code ${i.code})` : ""}: $${Number(i.amount).toFixed(2)}`)
      .join("\n");

    const subject = `Line-item review request — bill from ${data.hospitalName || "your facility"}`;
    const body = `Hello ${data.hospitalName || "Billing team"},

I'm reaching out to request a line-item review of a recent bill on my account, with the help of MediCura.

Total charged: $${Number(bill.total_amount ?? 0).toFixed(2)}

Charges I'd like to verify:
${itemList || "(no parsed line items)"}

${flagged.length ? `Items I'd especially appreciate clarification on:\n${flagged.map((f) => `- ${f.description}`).join("\n")}\n\n` : ""}${
      data.userQuestions ? `Additional questions:\n${data.userQuestions}\n\n` : ""
    }Could you please confirm each line, the corresponding codes, and any duplicate or pricing concerns?

Thank you for your help.`;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Resend not configured");

    const fromAddr = process.env.RESEND_FROM_EMAIL || "MediCura <onboarding@resend.dev>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      throw new Error(`Email failed (${res.status}): ${txt}`);
    }

    return { ok: true };
  });
