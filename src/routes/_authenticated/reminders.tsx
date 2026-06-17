import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pill, Plus, Trash2, Bell, BellOff, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Reminders — MediCura" }] }),
  component: RemindersPage,
});

const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

function RemindersPage() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof Notification === "undefined") setNotifPermission("unsupported");
    else setNotifPermission(Notification.permission);
  }, []);

  const reminders = useQuery({
    queryKey: ["reminders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user!.id)
        .order("schedule_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // simple in-tab scheduler: every minute, fire notification for due reminders.
  useEffect(() => {
    if (!reminders.data || notifPermission !== "granted") return;
    const firedKey = "medicura.firedReminders";
    const interval = setInterval(() => {
      const now = new Date();
      const day = ["sun","mon","tue","wed","thu","fri","sat"][now.getDay()];
      const hhmm = now.toTimeString().slice(0, 5);
      const fired: string[] = JSON.parse(sessionStorage.getItem(firedKey) || "[]");
      for (const r of reminders.data) {
        if (!r.active) continue;
        if (!r.days_of_week.includes(day)) continue;
        if (r.schedule_time.slice(0, 5) !== hhmm) continue;
        const key = `${r.id}-${now.toDateString()}-${hhmm}`;
        if (fired.includes(key)) continue;
        new Notification("Time for your medication", {
          body: `${r.medication_name}${r.dosage ? ` · ${r.dosage}` : ""}`,
          icon: "/favicon.ico",
        });
        fired.push(key);
        sessionStorage.setItem(firedKey, JSON.stringify(fired));
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [reminders.data, notifPermission]);

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("reminders")
        .update({ active })
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reminder deleted");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  const logTaken = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminder_logs").insert({ reminder_id: id, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Marked as taken"),
  });

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifPermission(p);
    if (p === "granted") toast.success("Notifications enabled");
  }

  return (
    <AppShell
      title="Pill reminders"
      description="Never miss a dose."
      actions={
        <div className="flex gap-2">
          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <Button variant="outline" size="sm" onClick={requestPermission}>
              <Bell className="mr-2 h-4 w-4" /> Enable notifications
            </Button>
          )}
          {notifPermission === "granted" && (
            <Badge variant="secondary" className="bg-success/15 text-success">
              <Bell className="mr-1 h-3 w-3" /> Notifications on
            </Badge>
          )}
          <ReminderDialog />
        </div>
      }
    >
      {reminders.isLoading ? (
        <Skeleton className="h-48" />
      ) : reminders.data && reminders.data.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reminders.data.map((r) => (
            <Card key={r.id} className={r.active ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Pill className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{r.medication_name}</CardTitle>
                      <CardDescription>{r.dosage || "Dose not set"}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={r.active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: r.id, active: checked })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-mono">{r.schedule_time.slice(0, 5)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d) => (
                    <Badge
                      key={d.id}
                      variant={r.days_of_week.includes(d.id) ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {d.label}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => logTaken.mutate(r.id)}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Mark taken
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BellOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No reminders yet</p>
              <p className="text-sm text-muted-foreground">Add your first medication to get gentle nudges throughout the day.</p>
            </div>
            <ReminderDialog />
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function ReminderDialog() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<string[]>(DAYS.map((d) => d.id));

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("reminders").insert({
        user_id: user.id,
        medication_name: name,
        dosage: dosage || null,
        schedule_time: `${time}:00`,
        days_of_week: days,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reminder added");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      setOpen(false);
      setName(""); setDosage(""); setTime("08:00"); setDays(DAYS.map((d) => d.id));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add reminder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New pill reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="med">Medication</Label>
            <Input id="med" value={name} onChange={(e) => setName(e.target.value)} placeholder="Atorvastatin" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dos">Dosage</Label>
              <Input id="dos" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="10 mg" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <label key={d.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
                  <Checkbox
                    checked={days.includes(d.id)}
                    onCheckedChange={(c) =>
                      setDays((prev) => (c ? [...prev, d.id] : prev.filter((x) => x !== d.id)))
                    }
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!name || days.length === 0 || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
