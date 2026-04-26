import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/current-user";
import { TrainingDoc } from "@/components/TrainingDoc";

export const metadata = { title: "Training — Translator" };

export default async function TranslatorTrainingPage() {
  await requireRole(["admin", "pm", "translator", "reviewer"]);
  return (
    <>
      <PageHeader title="Translator training" subtitle="The editor in detail — TM matches, term highlights, MT, QA findings, keyboard shortcuts." />
      <TrainingDoc role="translator" />
    </>
  );
}
