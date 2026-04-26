import { PageHeader } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/current-user";
import { TrainingDoc } from "@/components/TrainingDoc";

export const metadata = { title: "Training — PM" };

export default async function PmTrainingPage() {
  await requireRole(["admin", "pm"]);
  return (
    <>
      <PageHeader title="PM training" subtitle="How to manage jobs, attach TMs/termbases, run QA, and ship deliveries." />
      <TrainingDoc role="pm" />
    </>
  );
}
