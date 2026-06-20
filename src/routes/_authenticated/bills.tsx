import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileText } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatCurrency } from "@/lib/currency";


export const Route = createFileRoute("/_authenticated/bills")({
  head: () => ({ meta: [{ title: "Bills — MediCura" }] }),
  component: BillsLayout,
});

function BillsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Render outlet for nested routes (upload / detail)
  if (pathname !== "/bills") return <Outlet />;

  return <BillsList />;
}

function BillsList() {
  const { data: user } = useCurrentUser();
  const bills = useQuery({
    queryKey: ["bills", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell
      title="Bills"
      description="Every medical bill you've decoded with MediCura."
      actions={
        <Button asChild size="sm">
          <Link to="/bills/upload"><Upload className="mr-2 h-4 w-4" /> Upload bill</Link>
        </Button>
      }
    >
      {bills.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : bills.data && bills.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bills.data.map((b) => (
            <Link key={b.id} to="/bills/$billId" params={{ billId: b.id }}>
              <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{b.hospital_name || "Untitled bill"}</CardTitle>
                    {Number(b.potential_savings) > 0 && (
                      <Badge variant="secondary" className="bg-success/15 text-success-foreground">
                        Save {formatCurrency(b.potential_savings, b.currency, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{new Date(b.created_at).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl font-semibold">{formatCurrency(b.total_amount, b.currency)}</div>

                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{b.plain_summary || "Tap to view itemized breakdown."}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No bills uploaded yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">Drag in a PDF or photo of a medical bill — we'll parse it into clear line items.</p>
            </div>
            <Button asChild>
              <Link to="/bills/upload"><Upload className="mr-2 h-4 w-4" /> Upload your first bill</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
