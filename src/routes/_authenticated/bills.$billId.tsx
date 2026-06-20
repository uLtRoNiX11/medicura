import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Flag, Pill, Mail, Loader2, Sparkles, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { sendBillingReviewEmail, type EmailDraft } from "@/lib/email.functions";
import { findAlternatives, type AlternativeMatch } from "@/lib/medications.functions";
import { formatCurrency } from "@/lib/currency";

type BillingItem = {
  description: string;
  code?: string;
  amount: number;
  flag?: { reason: string; severity: "info" | "warning" | "high" } | null;
  cheaper_alternative?: { name: string; estimated_cost: number } | null;
};

type ExtractedMedication = {
  medicationName: string;
  dosage?: string | null;
  frequency?: string | null;
};

export const Route = createFileRoute("/_authenticated/bills/$billId")({
  head: () => ({ meta: [{ title: "Bill detail — MediCura" }] }),
  component: BillDetail,
});

const MED_KEYWORDS = [
  "mg", "mcg", "tablet", "capsule", "rx", "injection", "vial", "inhaler", "syrup", "oral", "iv ",
];

function extractMedicationNames(items: BillingItem[], extracted: ExtractedMedication[]): string[] {
  const names = new Set<string>();
  for (const m of extracted) {
    if (m.medicationName) names.add(m.medicationName);
  }
  for (const item of items) {
    const desc = item.description.toLowerCase();
    if (MED_KEYWORDS.some((k) => desc.includes(k))) {
      // strip dosing markers to leave a cleaner med name
      const cleaned = item.description.replace(/\d+\s*(mg|mcg|ml|g)\b.*$/i, "").trim();
      if (cleaned.length > 1) names.add(cleaned);
    }
  }
  return Array.from(names).slice(0, 8);
}

function BillDetail() {
  const { billId } = Route.useParams();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const findAlternativesFn = useServerFn(findAlternatives);

  const bill = useQuery({
    queryKey: ["bill", billId],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("id", billId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Bill not found");
      return data;
    },
  });

  const items = useMemo(
    () => (bill.data?.billing_items as unknown as BillingItem[]) || [],
    [bill.data],
  );
  const extractedMeds = useMemo(
    () => ((bill.data?.billing_items as unknown as ExtractedMedication[] | undefined) ? [] : []),
    [bill.data],
  );
  const medNames = useMemo(() => extractMedicationNames(items, extractedMeds), [items, extractedMeds]);

  const alternatives = useQuery({
    queryKey: ["alternatives", billId, medNames.join(",")],
    enabled: medNames.length > 0,
    queryFn: () => findAlternativesFn({ data: { medicationNames: medNames } }),
  });

  if (bill.isLoading) {
    return (
      <AppShell title="Loading bill…">
        <Skeleton className="h-96" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={bill.data?.hospital_name || "Bill detail"}
      description={`Decoded ${new Date(bill.data!.created_at).toLocaleDateString()}`}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/bills" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      }
    >
      {bill.data?.plain_summary && (
        <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-accent/20">
          <CardContent className="flex gap-3 p-5">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Plain-English summary</p>
              <p className="mt-1 text-sm leading-relaxed">{bill.data.plain_summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Itemized charges</CardTitle>
            <CardDescription>
              Total ${Number(bill.data?.total_amount ?? 0).toFixed(2)}
              {Number(bill.data?.potential_savings ?? 0) > 0 && (
                <> · Estimated savings ${Number(bill.data!.potential_savings).toFixed(2)}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No line items extracted.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>MediCura flag</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="font-medium">{item.description}</div>
                        {item.code && (
                          <div className="text-xs text-muted-foreground">Code {item.code}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.flag ? (
                          <Badge variant="secondary" className={
                            item.flag.severity === "high"
                              ? "bg-destructive/15 text-destructive"
                              : item.flag.severity === "warning"
                              ? "bg-warning/20 text-warning-foreground"
                              : "bg-info/15 text-info"
                          }>
                            <Flag className="mr-1 h-3 w-3" />
                            {item.flag.reason}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${Number(item.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Pill className="h-4 w-4 text-primary" /> Medication optimizer
              </CardTitle>
              <CardDescription>Cheaper alternatives we spotted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {medNames.length === 0 && (
                <p className="text-sm text-muted-foreground">No medication line items detected on this bill.</p>
              )}
              {alternatives.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking up alternatives…
                </div>
              )}
              {alternatives.data?.map((m: AlternativeMatch, i: number) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{m.name}</div>
                    {m.average_cost != null && (
                      <Badge variant="outline">${m.average_cost.toFixed(0)}</Badge>
                    )}
                  </div>
                  {(m.cheaper_alternative || m.generic_equivalent) && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        → {m.cheaper_alternative || m.generic_equivalent}
                      </span>
                      {m.alternative_cost != null && (
                        <Badge className="bg-success text-success-foreground">
                          ${m.alternative_cost.toFixed(0)}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-success/15 text-success text-[10px]">
                      <Sparkles className="mr-1 h-3 w-3" /> Savings opportunity
                    </Badge>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      via {m.source === "database" ? "MediCura DB" : "AI lookup"}
                    </span>
                  </div>
                  {m.savings_note && (
                    <p className="mt-2 text-xs text-muted-foreground">{m.savings_note}</p>
                  )}
                </div>
              ))}
              {alternatives.data?.length === 0 && medNames.length > 0 && !alternatives.isLoading && (
                <p className="text-sm text-muted-foreground">
                  No cheaper alternatives found for the medications on this bill.
                </p>
              )}
            </CardContent>
          </Card>

          <ReviewDialog billId={billId} hospitalName={bill.data?.hospital_name || ""} />
        </div>
      </div>
    </AppShell>
  );
}

function ReviewDialog({ billId, hospitalName }: { billId: string; hospitalName: string }) {
  const send = useServerFn(sendBillingReviewEmail);
  const [open, setOpen] = useState(false);
  const [hospitalEmail, setHospitalEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState<{ draft: EmailDraft; reason: string } | null>(null);

  async function onSend() {
    setLoading(true);
    setFallback(null);
    try {
      const result = await send({ data: { billId, hospitalEmail, hospitalName, userQuestions: notes } });
      if (result.ok) {
        toast.success("Review request sent");
        setOpen(false);
        setNotes("");
      } else {
        console.warn("Email send fell back:", result.reason);
        setFallback({ draft: result.draft, reason: result.reason });
        toast.warning("Email service unavailable — use the fallback below.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send email");
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft() {
    if (!fallback) return;
    const text = `To: ${fallback.draft.to}\nSubject: ${fallback.draft.subject}\n\n${fallback.draft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Draft copied to clipboard");
    } catch {
      toast.error("Couldn't access clipboard");
    }
  }

  function mailtoHref() {
    if (!fallback) return "#";
    const { to, subject, body } = fallback.draft;
    return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFallback(null); }}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline">
          <Mail className="mr-2 h-4 w-4" /> Request line-item review
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email the billing office</DialogTitle>
          <DialogDescription>We'll draft a polite request asking them to clarify and review the flagged items.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hosEmail">Billing office email</Label>
            <Input id="hosEmail" type="email" required value={hospitalEmail} onChange={(e) => setHospitalEmail(e.target.value)} placeholder="billing@hospital.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Anything specific to mention?</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="E.g. I was charged twice for the same lab." rows={4} />
          </div>

          {fallback && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium">Couldn't send automatically</p>
              <p className="mt-1 text-xs text-muted-foreground">{fallback.reason}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={copyDraft}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy draft
                </Button>
                <a
                  href={mailtoHref()}
                  className="inline-flex items-center rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open in mail app
                </a>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onSend} disabled={loading || !hospitalEmail}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
