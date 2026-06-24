import { Suspense } from "react";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    }>
      {children}
    </Suspense>
  );
}
