import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/current-user";
import { TrainingDoc } from "@/components/TrainingDoc";

export const metadata = { title: "Training — Admin" };

export default async function AdminTrainingPage() {
  await requireRole(["admin"]);
  return (
    <>
      <PageHeader title="Admin training" subtitle="Reference guide for every admin-facing screen, with screenshots and common workflows." />
      <TrainingDoc role="admin" />
    </>
  );
}
