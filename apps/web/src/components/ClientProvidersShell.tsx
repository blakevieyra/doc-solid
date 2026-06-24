"use client";

import dynamic from "next/dynamic";

const Providers = dynamic(
  () => import("@/components/Providers").then((m) => m.Providers),
  {
    ssr: false,
    loading: () => (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading DocSolid...</p>
      </div>
    ),
  }
);

export function ClientProvidersShell({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
