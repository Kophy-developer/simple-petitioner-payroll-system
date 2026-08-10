#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const HOSTS = ["https://api.brex.com", "https://platform.brexapis.com"];

async function probe(token, pathAndQuery) {
  let last = { path: pathAndQuery, status: 0, ok: false, itemCount: null, errorSnippet: "none" };
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${pathAndQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const text = await res.text();
      let itemCount = null;
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json.items)) itemCount = json.items.length;
      } catch {}
      last = {
        path: pathAndQuery,
        host,
        status: res.status,
        ok: res.ok,
        itemCount,
        errorSnippet: res.ok ? null : text.slice(0, 220),
      };
      if (res.ok) return last;
    } catch (e) {
      last = {
        path: pathAndQuery,
        host,
        status: 0,
        ok: false,
        itemCount: null,
        errorSnippet: e instanceof Error ? e.message : "fetch failed",
      };
    }
  }
  return last;
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const env = loadEnv(path.join(root, "web", ".env.local"));
  const token = (env.BREX_API_TOKEN || "").trim();
  if (!token) {
    console.error(JSON.stringify({ ok: false, error: "BREX_API_TOKEN missing in web/.env.local" }, null, 2));
    process.exit(1);
  }

  const probes = await Promise.all([
    probe(token, "/v2/accounts/cash?limit=10"),
    probe(token, "/v1/vendors?limit=10"),
    probe(token, "/v1/transfers?limit=10"),
    probe(token, "/v1/expenses?limit=1"),
  ]);

  const paymentScopesOk = probes[0].ok && probes[1].ok && probes[2].ok;
  const report = {
    ok: paymentScopesOk,
    mode: "dry_run",
    liveTransferSubmitted: false,
    paymentScopesOk,
    expensesReadable: probes[3].ok,
    tokenPrefix: token.slice(0, 8),
    probes,
    note: paymentScopesOk
      ? "Payment scopes work. No ACH transfer was created."
      : "Payment endpoint probe failed — check vendors/transfers/cash scopes on the token.",
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(paymentScopesOk ? 0 : 2);
}

main();
