import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

function loadEnv(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

await loadEnv(await readFile(".env.local", "utf8"));

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const password = process.env.SUPABASE_DB_PASSWORD;
const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ap-south-1",
  "sa-east-1",
];

const candidates = [];
for (const region of regions) {
  for (const generation of [0, 1]) {
    for (const port of [6543, 5432]) {
      for (const user of [`postgres.${projectRef}`, "postgres"]) {
        candidates.push({
          label: `aws-${generation}-${region}:${port}:${user}`,
          host: `aws-${generation}-${region}.pooler.supabase.com`,
          port,
          user,
        });
      }
    }
  }
}

for (const candidate of candidates) {
  const code = `
    const { Client } = require("pg");
    const client = new Client({
      host: ${JSON.stringify(candidate.host)},
      port: ${candidate.port},
      database: "postgres",
      user: ${JSON.stringify(candidate.user)},
      password: ${JSON.stringify(password)},
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
    client.on("error", () => {});
    client.connect()
      .then(() => client.query("select current_user as user").then((r) => {
        console.log(JSON.stringify(r.rows[0]));
        return client.end();
      }))
      .then(() => process.exit(0))
      .catch((err) => {
        console.error((err && err.message) || String(err));
        process.exit(1);
      });
  `;

  const result = spawnSync(process.execPath, ["-e", code], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 8000,
  });

  if (result.status === 0) {
    console.log(`OK ${candidate.label} ${result.stdout.trim()}`);
    process.exit(0);
  }

  const stderr = result.stderr.trim().split(/\r?\n/).at(-1) ?? "";
  console.log(`NO ${candidate.label} ${stderr}`);
}

process.exit(1);
