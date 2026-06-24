import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("[db] Skipping prisma db push — DATABASE_URL not set (ok for local builds)");
  process.exit(0);
}

execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
