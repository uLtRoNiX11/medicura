import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Flag, Pill, Mail, Loader2, Sparkles } from "lucide-react";
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
import { sendBillingReviewEmail } from "@/lib/email.functions";

type BillingItem = {
  description: string;
  code?: string;
  amount: number;
  flag?: { reason: string; severity: "info" | "warning" | "high" } | null;
  cheaper_alternative?: { name: string; estimated_cost: number } | null;
};

export const Route = createFileRoute("/_authenticated/bills/$billId")({
  head: () => ({ meta: [{ title: "Bill detail — MediCura" }] }),
  component: BillDetail,
});

function BillDetail() {
  const { billId } = Route.useParams();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();

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

  const meds = useQuery({
    queryKey: ["medications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("medications").select("*");
      if (error) throw error;
      return data;
    },
  });

  if (bill.isLoading) {
    return (
      <AppShell title="Loading bill…">
        <Skeleton className="h-96" />
      </AppShell>
    );
  }

  const items = (bill.data?.billing_items as unknown as BillingItem[]) || [];

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
              {findMedicationMatches(items, meds.data || []).map((m, i) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{m.name}</div>
                    <Badge variant="outline">${m.average_cost?.toFixed(0)}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">→ {m.cheaper_alternative}</span>
                    <Badge className="bg-success text-success-foreground">${m.alternative_cost?.toFixed(0)}</Badge>
                  </div>
                </div>
              ))}
              {findMedicationMatches(items, meds.data || []).length === 0 && (
                <p className="text-sm text-muted-foreground">No medication matches on this bill.</p>
              )}
            </CardContent>
          </Card>

          <ReviewDialog billId={billId} hospitalName={bill.data?.hospital_name || ""} />
        </div>
      </div>
    </AppShell>
  );
}

function findMedicationMatches(items: BillingItem[], meds: Array<{ name: string; average_cost: number | null; cheaper_alternative: string | null; alternative_cost: number | null }>) {
  const lower = items.map((i) => i.description.toLowerCase());
  return meds.filter((m) => lower.some((d) => d.includes(m.name.toLowerCase())));
}

function ReviewDialog({ billId, hospitalName }: { billId: string; hospitalName: string }) {
  const send = useServerFn(sendBillingReviewEmail);
  const [open, setOpen] = useState(false);
  const [hospitalEmail, setHospitalEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSend() {
    setLoading(true);
    try {
      await send({ data: { billId, hospitalEmail, hospitalName, userQuestions: notes } });
      toast.success("Review request sent");
      setOpen(false);
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
