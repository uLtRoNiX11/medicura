import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleHeart, Send, X, Sparkles, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useActiveThreadId, setActiveThreadId } from "@/hooks/use-active-thread";

const SUGGESTIONS = [
  "Explain my latest bill items",
  "Are there any hidden fees in my history?",
  "Suggest cheaper medication alternatives",
];

type Msg = { id: string; role: "user" | "assistant"; content: string };

export const CHAT_OPEN_EVENT = "medicura:chat-open";

export function ChatWidget() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const threadId = useActiveThreadId();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(CHAT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, onOpen);
  }, []);

  const messages = useQuery({
    queryKey: ["chat-messages", threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((m) => {
        const parts = m.parts as Array<{ type: string; text?: string }>;
        return {
          id: m.id,
          role: m.role as "user" | "assistant",
          content: parts.map((p) => p.text || "").join(""),
        } satisfies Msg;
      });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.data?.length, open]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Not signed in");
      let tid = threadId;
      if (!tid) {
        const { data: t, error } = await supabase
          .from("chat_threads")
          .insert({ user_id: user.id, title: text.slice(0, 60) })
          .select("id")
          .single();
        if (error) throw error;
        tid = t.id;
        setThreadId(tid);
      }

      await supabase.from("chat_messages").insert({
        thread_id: tid,
        user_id: user.id,
        role: "user",
        parts: [{ type: "text", text }],
      });

      // build prior conversation
      const { data: prior } = await supabase
        .from("chat_messages")
        .select("role, parts")
        .eq("thread_id", tid)
        .order("created_at", { ascending: true });

      // gather recent bills for context
      const { data: bills } = await supabase
        .from("bills")
        .select("hospital_name,total_amount,plain_summary,billing_items,potential_savings,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const systemContext = `You are MediCura, a friendly healthcare billing assistant. Your ONLY purpose is to help users understand their medical bills, identify potential overcharges or hidden fees, suggest cheaper medication alternatives, explain insurance/billing terminology, and guide them on next steps with providers.

STRICT SCOPE RULES:
- You MUST refuse any request unrelated to healthcare, medical bills, medications, insurance, or the user's MediCura data. This includes coding help (Python, JavaScript, etc.), general knowledge questions, creative writing, math homework, recipes, translations, or anything off-topic.
- If asked something off-topic, politely decline in one short sentence and redirect: "I can only help with your medical bills and medications — want me to review a recent charge or find cheaper alternatives?"
- Never write code, never generate scripts, never roleplay as a general-purpose assistant.
- Never give medical diagnoses — refer users to a licensed clinician.
- Answer concisely in plain English with empathy.

The user's recent bills (JSON): ${JSON.stringify(bills ?? []).slice(0, 6000)}`;

      const apiMessages = [
        { role: "system", content: systemContext },
        ...((prior ?? []).map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: (m.parts as Array<{ text?: string }>).map((p) => p.text || "").join(""),
        }))),
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!res.ok) {
        if (res.status === 429) throw new Error("Rate limit — wait a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted.");
        throw new Error("Chat error");
      }
      const { reply } = (await res.json()) as { reply: string };

      await supabase.from("chat_messages").insert({
        thread_id: tid,
        user_id: user.id,
        role: "assistant",
        parts: [{ type: "text", text: reply }],
      });

      return reply;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", threadId] });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  async function onSend(text?: string) {
    const t = (text ?? input).trim();
    if (!t) return;
    setInput("");
    send.mutate(t);
  }

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"
        aria-label="Open MediCura assistant"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircleHeart className="h-6 w-6" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-40 flex h-[32rem] w-[22rem] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b bg-gradient-to-r from-primary/10 to-accent/40 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-display text-sm font-semibold leading-tight">MediCura Assistant</p>
                <p className="text-[10px] text-muted-foreground">Grounded in your private bills</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {!messages.data?.length && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Try asking…</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                        onClick={() => onSend(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {messages.data?.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {send.isPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> MediCura is thinking…
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); onSend(); }}
              className="flex items-center gap-2 border-t bg-background/50 p-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your bills…"
                className="h-9"
              />
              <Button size="icon" type="submit" className="h-9 w-9 shrink-0" disabled={send.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
