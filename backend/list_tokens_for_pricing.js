// Node 18+
// Usage: node list_tokens_for_pricing.js transactions.json > tokens_for_pricing.json
const fs = require("fs");

if (process.argv.length < 3) {
  console.error("Usage: node list_tokens_for_pricing.js <transactions.json>");
  process.exit(1);
}

const inputPath = process.argv[2];
const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const byContract = new Map();

for (const tx of data) {
  const transfers = tx?.token_transfers || [];
  for (const t of transfers) {
    const contract = t.contract?.toLowerCase();
    if (!contract) continue;

    if (!byContract.has(contract)) {
      byContract.set(contract, {
        contract,
        symbol: t.token ?? null,
        decimals: Number.isFinite(+t.decimals) ? +t.decimals : null,
      });
    } else {
      // fill any missing metadata if later entries have it
      const cur = byContract.get(contract);
      if (!cur.symbol && t.token) cur.symbol = t.token;
      if (cur.decimals == null && Number.isFinite(+t.decimals)) cur.decimals = +t.decimals;
    }
  }
}

const out = Array.from(byContract.values()).sort((a, b) => a.contract.localeCompare(b.contract));
console.log(JSON.stringify(out, null, 2));
