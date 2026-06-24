export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Page not found</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>The page you are looking for does not exist.</p>
      <a href="/" style={{ color: "var(--primary)", fontWeight: 600 }}>Go home</a>
    </div>
  );
}
