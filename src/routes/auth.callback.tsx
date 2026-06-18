import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, HeartPulse, Loader2, AlertTriangle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Verifying — MediCura" }] }),
  component: AuthCallbackPage,
});

type Status = "loading" | "success" | "error";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Confirming your account…");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        // Supabase places either a hash fragment (#access_token=...) or a ?code=... query.
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);
        const errorDescription =
          hashParams.get("error_description") || queryParams.get("error_description");
        if (errorDescription) {
          if (!cancelled) {
            setStatus("error");
            setMessage(errorDescription);
          }
          return;
        }

        const code = queryParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setStatus("success");
          setMessage("Account verified! Redirecting you to your dashboard…");
          setTimeout(() => navigate({ to: "/", replace: true }), 1200);
        } else {
          setStatus("success");
          setMessage(
            "Account verified successfully! You can return to your dashboard or close this window."
          );
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Could not verify your account.");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-secondary/30 to-accent/30 px-4 py-12">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,oklch(0.85_0.05_165/0.4),transparent_55%),radial-gradient(circle_at_85%_85%,oklch(0.85_0.08_220/0.35),transparent_55%)]" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">MediCura</span>
        </div>
        <Card className="border-border/60 shadow-xl shadow-primary/5 backdrop-blur-sm">
          <CardHeader className="space-y-3 text-center">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                status === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {status === "loading" && <Loader2 className="h-7 w-7 animate-spin" />}
              {status === "success" && <CheckCircle2 className="h-7 w-7" />}
              {status === "error" && <AlertTriangle className="h-7 w-7" />}
            </div>
            <CardTitle className="font-display text-2xl">
              {status === "loading" && "Verifying…"}
              {status === "success" && "You're all set"}
              {status === "error" && "Verification failed"}
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link to="/">Go to dashboard</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
