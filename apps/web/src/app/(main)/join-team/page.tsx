"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { JoinTeamForm } from "./JoinTeamForm";

function JoinTeamPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading || !session) return;
    const code = searchParams?.get("code");
    router.replace(code ? `/team?code=${encodeURIComponent(code)}` : "/team");
  }, [loading, session, searchParams, router]);

  if (loading || session) {
    return (
      <div className="auth-page">
        <div className="auth-card"><p>Loading…</p></div>
      </div>
    );
  }

  return <JoinTeamForm />;
}

export default function JoinTeamPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-card"><p>Loading…</p></div>
      </div>
    }>
      <JoinTeamPageContent />
    </Suspense>
  );
}
