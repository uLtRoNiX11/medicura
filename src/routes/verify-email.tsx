import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MailCheck, HeartPulse, Loader2, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/verify-email")({
  head: () => ({
    meta: [
      { title: "Verify your email — MediCura" },
      {
        name: "description",
        content:
          "Confirm your email address to activate your MediCura account and start decoding medical bills.",
      },
      { property: "og:title", content: "Verify your email — MediCura" },
      {
        property: "og:description",
        content: "Confirm your email to activate your MediCura account.",
      },
      { property: "og:url", content: "https://medicura.lovable.app/verify-email" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://medicura.lovable.app/verify-email" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { email } = Route.useSearch();
  const [polling, setPolling] = useState(true);

  // Auto-login the moment the user confirms in another tab / device.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED")) {
        navigate({ to: "/", replace: true });
      }
    });
    // belt-and-suspenders: poll every 4s in case the listener missed the event
    const interval = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPolling(false);
        navigate({ to: "/", replace: true });
      }
    }, 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [navigate]);

  async function resend() {
    if (!email) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      const { toast } = await import("sonner");
      toast.error(error.message);
    } else {
      const { toast } = await import("sonner");
      toast.success("Verification email resent");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-secondary/30 to-accent/30 px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,oklch(0.85_0.05_165/0.4),transparent_55%),radial-gradient(circle_at_85%_85%,oklch(0.85_0.08_220/0.35),transparent_55%)]" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <h1 className="sr-only">Verify your email</h1>
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">MediCura</span>
        </div>
        <Card className="border-border/60 shadow-xl shadow-primary/5 backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MailCheck className="h-7 w-7" />
            </div>
            <CardTitle className="font-display text-2xl">Check your inbox</CardTitle>
            <CardDescription>
              We&apos;ve sent a verification link{email ? <> to <span className="font-medium text-foreground">{email}</span></> : null}.
              Click it to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {polling && <Loader2 className="h-3 w-3 animate-spin" />}
              Waiting for confirmation — you&apos;ll be signed in automatically.
            </div>
            {email && (
              <Button variant="outline" className="w-full" onClick={resend}>
                Resend verification email
              </Button>
            )}
            <Link
              to="/auth"
              className="inline-flex w-full items-center justify-center text-sm text-primary hover:underline"
            >
              <ArrowLeft className="mr-1 h-3 w-3" /> Back to sign in
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
