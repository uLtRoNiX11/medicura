import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UploadCloud, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { parseBill } from "@/lib/bills.functions";

export const Route = createFileRoute("/_authenticated/bills/upload")({
  head: () => ({ meta: [{ title: "Upload a bill — MediCura" }] }),
  component: UploadPage,
});

function UploadPage() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const parse = useServerFn(parseBill);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("bills").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadErr) throw uploadErr;

      const { data: signed, error: signedErr } = await supabase.storage
        .from("bills")
        .createSignedUrl(path, 60 * 10);
      if (signedErr) throw signedErr;

      const result = await parse({ data: { fileUrl: signed.signedUrl, mimeType: file.type } });
      return result;
    },
    onSuccess: (result) => {
      toast.success("Bill decoded");
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      navigate({ to: "/bills/$billId", params: { billId: result.billId } });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    },
  });

  function onFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      toast.error("File too large (max 15 MB)");
      return;
    }
    setFile(f);
  }

  return (
    <AppShell
      title="Upload a bill"
      description="PDF or image. We'll parse it into clear line items."
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/bills" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="p-6 md:p-8">
            <motion.label
              htmlFor="bill-file"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onFiles(e.dataTransfer.files);
              }}
              animate={{ scale: dragOver ? 1.01 : 1 }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UploadCloud className="h-7 w-7" />
              </div>
              <p className="mt-4 font-medium">
                {file ? file.name : "Drag your bill here or click to choose"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">PDF, JPG, or PNG · max 15 MB</p>
              <input
                ref={inputRef}
                id="bill-file"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </motion.label>

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" />
                Parsed privately to your account using MediCura AI.
              </p>
              <Button
                disabled={!file || upload.isPending}
                onClick={() => file && upload.mutate(file)}
              >
                {upload.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Decode bill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
