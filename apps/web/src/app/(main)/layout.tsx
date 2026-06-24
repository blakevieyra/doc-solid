import { ClientProvidersShell } from "@/components/ClientProvidersShell";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <ClientProvidersShell>{children}</ClientProvidersShell>;
}
