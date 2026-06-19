import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageCircleHeart, Plus, MessageSquare } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ChatWidget, CHAT_OPEN_EVENT } from "@/components/chat-widget";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useActiveThreadId, setActiveThreadId } from "@/hooks/use-active-thread";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Assistant — MediCura" }] }),
  component: ChatPage,
});

function openWidget() {
  window.dispatchEvent(new Event(CHAT_OPEN_EVENT));
}

function ChatPage() {
  const { data: user } = useCurrentUser();
  const activeId = useActiveThreadId();

  const threads = useQuery({
    queryKey: ["chat-threads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function startNew() {
    setActiveThreadId(null);
    openWidget();
  }

  function openThread(id: string) {
    setActiveThreadId(id);
    openWidget();
  }

  return (
    <AppShell
      title="Assistant"
      description="Chat with MediCura about your bills and medications."
      actions={
        <Button onClick={startNew} size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> New chat
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Previous chats
              </p>
              <span className="text-[10px] text-muted-foreground">
                {threads.data?.length ?? 0}
              </span>
            </div>
            <ScrollArea className="h-[26rem]">
              {threads.isLoading && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">Loading…</p>
              )}
              {!threads.isLoading && !threads.data?.length && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <Button size="sm" variant="outline" onClick={startNew}>
                    Start your first chat
                  </Button>
                </div>
              )}
              <ul className="space-y-1">
                {threads.data?.map((t) => {
                  const active = t.id === activeId;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => openThread(t.id)}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition hover:bg-muted ${
                          active ? "bg-primary/10 text-primary" : ""
                        }`}
                      >
                        <span className="line-clamp-1 text-sm font-medium">
                          {t.title || "Untitled chat"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircleHeart className="h-6 w-6" />
            </div>
            <p className="font-medium">
              {activeId ? "Continuing your last conversation" : "Start a fresh conversation"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Select a chat on the left to pick up where you left off, or start a new one. Your
              history is saved automatically and follows you across tabs.
            </p>
            <Button onClick={openWidget}>Open assistant</Button>
          </CardContent>
        </Card>
      </div>
      <ChatWidget />
    </AppShell>
  );
}
