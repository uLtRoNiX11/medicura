import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileText, Pill, PiggyBank, Upload, ArrowRight, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile, useCurrentUser } from "@/hooks/use-current-user";
import { ChatWidget } from "@/components/chat-widget";
import { formatCurrency } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Medical Care Dashboard — MediCura" },
      {
        name: "description",
        content:
          "Your MediCura dashboard: track decoded medical bills, estimated savings, and active medication reminders in one place.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: user } = useCurrentUser();
  const { data: profile } = useCurrentProfile();
  const userId = user?.id;

  const bills = useQuery({
    queryKey: ["bills", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const reminders = useQuery({
    queryKey: ["reminders", userId, "active"],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId!)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Aggregate totals per-currency (bills can be in different currencies)
  const totalsByCurrency = (bills.data ?? []).reduce<Record<string, { spent: number; savings: number }>>((acc, b) => {
    const code = (b.currency || "USD").toUpperCase();
    if (!acc[code]) acc[code] = { spent: 0, savings: 0 };
    acc[code].spent += Number(b.total_amount ?? 0);
    acc[code].savings += Number(b.potential_savings ?? 0);
    return acc;
  }, {});
  const currencyCodes = Object.keys(totalsByCurrency);
  // Pick the dominant currency (most bills) for the headline number
  const dominantCurrency =
    currencyCodes.sort(
      (a, b) =>
        (bills.data?.filter((x) => (x.currency || "USD").toUpperCase() === b).length ?? 0) -
        (bills.data?.filter((x) => (x.currency || "USD").toUpperCase() === a).length ?? 0),
    )[0] ?? "USD";
  const headline = totalsByCurrency[dominantCurrency] ?? { spent: 0, savings: 0 };
  const otherCurrencies = currencyCodes.filter((c) => c !== dominantCurrency);

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <AppShell
      title="Medical Care Dashboard"
      description="Your health spending and reminders at a glance."
      actions={
        <Button asChild size="sm">
          <Link to="/bills/upload">
            <Upload className="mr-2 h-4 w-4" /> Upload bill
          </Link>
        </Button>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8"
      >
        <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-accent/30 p-6 md:p-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Welcome back
          </div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Hi {firstName} — let's decode your care.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            Upload a medical bill to get a plain-English breakdown, flagged charges, and cheaper
            medication alternatives — all kept private to your account.
          </p>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={FileText}
          label="Bills uploaded"
          value={bills.data?.length ?? 0}
          loading={bills.isLoading}
          tone="info"
        />
        <MetricCard
          icon={PiggyBank}
          label="Estimated savings"
          value={formatCurrency(headline.savings, dominantCurrency)}
          subtitle={
            otherCurrencies.length > 0
              ? `Across ${formatCurrency(headline.spent, dominantCurrency)} in billed care (+ ${otherCurrencies.join(", ")})`
              : `Across ${formatCurrency(headline.spent, dominantCurrency)} in billed care`
          }
          loading={bills.isLoading}
          tone="success"
        />
        <MetricCard
          icon={Pill}
          label="Active reminders"
          value={reminders.data?.length ?? 0}
          loading={reminders.isLoading}
          tone="primary"
        />
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Recent bills</h3>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/bills">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </div>

        {bills.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : bills.data && bills.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bills.data.slice(0, 6).map((b) => (
              <Link key={b.id} to="/bills/$billId" params={{ billId: b.id }}>
                <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">
                        {b.hospital_name || "Untitled bill"}
                      </CardTitle>
                      {Number(b.potential_savings) > 0 && (
                        <Badge variant="secondary" className="bg-success/15 text-success-foreground">
                          Save {formatCurrency(b.potential_savings, b.currency, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {new Date(b.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="font-display text-2xl font-semibold">
                      {formatCurrency(b.total_amount ?? 0, b.currency)}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {b.plain_summary || "Tap to view itemized breakdown."}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No bills yet"
            description="Upload your first medical bill to see an AI-itemized breakdown and find cheaper alternatives."
            action={
              <Button asChild>
                <Link to="/bills/upload"><Upload className="mr-2 h-4 w-4" /> Upload your first bill</Link>
              </Button>
            }
          />
        )}
      </div>

      <ChatWidget />
    </AppShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  loading,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
  tone: "primary" | "success" | "info";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="font-display text-2xl font-semibold leading-tight">{value}</p>
          )}
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
