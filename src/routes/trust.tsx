import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & Privacy — MediCura" },
      {
        name: "description",
        content:
          "How MediCura handles your medical data: authentication, encryption in transit, row-level access controls, and privacy practices.",
      },
      { property: "og:title", content: "Trust & Privacy — MediCura" },
      {
        property: "og:description",
        content:
          "Learn how MediCura protects your medical bills, prescriptions, and personal information.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://medicura.lovable.app/trust" },
    ],
    links: [{ rel: "canonical", href: "https://medicura.lovable.app/trust" }],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to MediCura</Link>
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-foreground">
          Trust, Security & Privacy
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page is maintained by the MediCura team to answer common security and privacy
          questions about the app. It describes practices currently in place and is not an
          independent certification.
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Access & authentication</h2>
          <p className="text-sm text-muted-foreground">
            MediCura requires every user to sign in before viewing bills, prescriptions, or
            reminders. We support email/password and Google sign-in. Sessions are managed by
            our authentication provider and expire automatically.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Data isolation</h2>
          <p className="text-sm text-muted-foreground">
            Every bill, medication, and uploaded file is scoped to the account that created it.
            Database row-level security policies ensure one user cannot read or modify another
            user's records. Uploaded files are stored in per-user folders.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Encryption</h2>
          <p className="text-sm text-muted-foreground">
            All traffic between your browser and MediCura is encrypted in transit over HTTPS.
            Data at rest is stored by our managed backend provider.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">AI & third-party processing</h2>
          <p className="text-sm text-muted-foreground">
            Bill parsing, medication suggestions, and the chat assistant send relevant content
            to AI providers through a managed gateway to generate responses. We do not sell your
            data. Outbound email (for billing-office review requests) is delivered by our
            transactional email provider and only sent when you initiate it.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Your controls</h2>
          <p className="text-sm text-muted-foreground">
            You can delete individual bills, medications, and reminders from within the app at
            any time. To request full account deletion or a copy of your data, contact us.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Disclaimers</h2>
          <p className="text-sm text-muted-foreground">
            MediCura is a personal organization tool and does not provide medical, legal, or
            billing advice. AI-generated summaries can contain mistakes — always confirm
            charges with your provider and dosing with your pharmacist or doctor.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p className="text-sm text-muted-foreground">
            Security or privacy questions? Reach the maintainer through the app's support
            channels.
          </p>
        </section>
      </div>
    </main>
  );
}
