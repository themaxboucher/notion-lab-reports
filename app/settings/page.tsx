import { Workbench } from "@/components/workbench";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source } = await searchParams;
  return <Workbench source={source || "fixture"} />;
}
