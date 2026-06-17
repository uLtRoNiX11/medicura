import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ChatWidget } from "@/components/chat-widget";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircleHeart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Assistant — MediCura" }] }),
  component: ChatPage,
});

function ChatPage() {
  const navigate = useNavigate();
  return (
    <AppShell title="Assistant" description="Ask MediCura anything about your bills.">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircleHeart className="h-6 w-6" />
          </div>
          <p className="font-medium">Open the assistant from the floating button</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            The MediCura assistant lives in the bottom-right of every page so you can ask questions
            without losing your place.
          </p>
          <Button onClick={() => navigate({ to: "/" })}>Go to dashboard</Button>
        </CardContent>
      </Card>
      <ChatWidget />
    </AppShell>
  );
}
