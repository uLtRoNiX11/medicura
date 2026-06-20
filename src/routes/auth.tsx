import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, HeartPulse, Mail, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to MediCura" },
      {
        name: "description",
        content:
          "Sign in or create your MediCura account to decode medical bills, find cheaper medication alternatives, and manage dosing reminders securely.",
      },
      { property: "og:title", content: "Sign in to MediCura" },
      {
        property: "og:description",
        content:
          "Access your MediCura account to itemize medical bills and optimize medication costs with AI.",
      },
      { property: "og:url", content: "https://medicura.lovable.app/auth" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://medicura.lovable.app/auth" }],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // If email confirmation is required, no session is returned yet.
        if (data.session) {
          toast.success("Account created — you're signed in");
          navigate({ to: "/", replace: true });
        } else {
          navigate({ to: "/verify-email", search: { email }, replace: true });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset email sent — check your inbox");
        setMode("signin");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
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
        <h1 className="sr-only">
          {mode === "signin"
            ? "Sign in to MediCura"
            : mode === "signup"
              ? "Create your MediCura account"
              : "Reset your MediCura password"}
        </h1>
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">MediCura</span>
        </div>

        <Card className="border-border/60 shadow-xl shadow-primary/5 backdrop-blur-sm">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="font-display text-2xl">
              {mode === "signin" && "Welcome back"}
              {mode === "signup" && "Create your account"}
              {mode === "forgot" && "Reset your password"}
            </CardTitle>
            <CardDescription>
              {mode === "signin" && "Sign in to keep tabs on your bills and reminders."}
              {mode === "signup" && "Start decoding bills and saving on prescriptions in minutes."}
              {mode === "forgot" && "We'll email you a secure link to set a new password."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {mode !== "forgot" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9"
                      required
                      minLength={6}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signin" && "Sign in"}
                {mode === "signup" && "Create account"}
                {mode === "forgot" && "Send reset link"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" && (
                <>
                  New to MediCura?{" "}
                  <button onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                    Create an account
                  </button>
                </>
              )}
              {mode === "signup" && (
                <>
                  Already have an account?{" "}
                  <button onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                    Sign in
                  </button>
                </>
              )}
              {mode === "forgot" && (
                <button onClick={() => setMode("signin")} className="inline-flex items-center font-medium text-primary hover:underline">
                  <ArrowLeft className="mr-1 h-3 w-3" /> Back to sign in
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to MediCura's privacy and terms. Your health data is protected by row-level security.
        </p>
      </motion.div>
    </main>
  );
}
