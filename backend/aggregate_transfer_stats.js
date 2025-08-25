// Node 18+
// Usage: node aggregate_transfer_stats.js <input.json>
// Writes: transfer_stats.json, transfers_flat.json
const fs = require("fs");
const path = require("path");

if (process.argv.length < 3) {
  console.error("Usage: node aggregate_transfer_stats.js <transactions.json>");
  process.exit(1);
}

const inputPath = process.argv[2];

// ---------- Safe JSON load ----------
let rawText;
try {
  rawText = fs.readFileSync(inputPath, "utf8");
} catch (e) {
  console.error(`❌ Could not read file: ${inputPath}\n${e.message}`);
  process.exit(1);
}

let root;
try {
  root = JSON.parse(rawText);
} catch (e) {
  console.error("❌ Input is not valid JSON. First 200 chars:\n", rawText.slice(0, 200));
  process.exit(1);
}

// ---------- Normalize to array of tx objects ----------
function toTxArray(x) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.items)) return x.items;
  if (x && x.data && Array.isArray(x.data.items)) return x.data.items;
  if (x && x.data && Array.isArray(x.data)) return x.data;
  return []; // empty if unknown shape
}
const txs = toTxArray(root);

// ---------- Helpers ----------
const toNum = (x) => (x == null ? null : +x);
const isFiniteNum = (x) => typeof x === "number" && Number.isFinite(x);

function inferDexFlags(tx) {
  const f = (tx && tx.dex_flags) || {};
  const out = {
    is_swap: !!f.is_swap,
    is_liquidity_add: !!f.is_liquidity_add,
    is_liquidity_remove: !!f.is_liquidity_remove,
    saw_sync: !!f.saw_sync,
  };
  if ((!out.is_swap || !out.is_liquidity_add || !out.is_liquidity_remove || !out.saw_sync) && Array.isArray(tx?.log_events)) {
    for (const ev of tx.log_events) {
      const name = ev?.decoded?.name?.toLowerCase?.();
      if (!name) continue;
      if (name.includes("swap")) out.is_swap = true;
      if (name.includes("mint")) out.is_liquidity_add = true;
      if (name.includes("burn")) out.is_liquidity_remove = true;
      if (name.includes("sync")) out.saw_sync = true;
    }
  }
  return out;
}

function normalizeAmountFromRaw(raw, decimals) {
  const d = Number.isFinite(+decimals) ? +decimals : null;
  if (raw == null || d == null) return null;
  const n = Number(raw) / Math.pow(10, d);
  return Number.isFinite(n) ? n : null;
}

// extract transfers from either your enriched `token_transfers`
// or directly from Covalent `log_events` with decoded Transfer
function extractTransfers(tx) {
  const out = [];

  // 1) prefer already-enriched token_transfers
  if (Array.isArray(tx?.token_transfers) && tx.token_transfers.length) {
    for (const t of tx.token_transfers) {
      const amount =
        t.amount != null && t.amount !== "" ? +t.amount
        : normalizeAmountFromRaw(t.amount_raw, t.decimals);

      if (!isFiniteNum(amount)) continue; // skip bad amounts
      out.push({
        token: t.token ?? null,
        contract: t.contract ?? null,
        decimals: Number.isFinite(+t.decimals) ? +t.decimals : null,
        from: t.from ?? null,
        to: t.to ?? null,
        amount,
      });
    }
    return out;
  }

  // 2) derive from log_events
  if (Array.isArray(tx?.log_events)) {
    for (const ev of tx.log_events) {
      const dec = ev?.sender_contract_decimals;
      const name = ev?.decoded?.name;
      if (name !== "Transfer") continue;

      const params = ev?.decoded?.params || [];
      const from = params.find((p) => p.name === "from")?.value || null;
      const to = params.find((p) => p.name === "to")?.value || null;
      const valueRaw = params.find((p) => p.name === "value")?.value;

      const amount = normalizeAmountFromRaw(valueRaw, dec);
      if (!isFiniteNum(amount)) continue;

      out.push({
        token: ev?.sender_contract_ticker_symbol ?? ev?.sender_name ?? null,
        contract: ev?.sender_address ?? null,
        decimals: Number.isFinite(+dec) ? +dec : null,
        from,
        to,
        amount,
      });
    }
  }
  return out;
}

// ---------- Aggregation ----------
const global = {
  total_txs: 0,
  total_successful_txs: 0,
  total_token_transfers: 0,
  total_swaps: 0,
  total_liquidity_adds: 0,
  total_liquidity_removes: 0,
  total_sync_events_seen: 0,
};

const perToken = new Map(); // key: contract lowercased
const transfersFlat = [];

for (const tx of txs) {
  if (!tx || typeof tx !== "object") continue;

  global.total_txs += 1;
  if (tx.success === true || tx.successful === true) global.total_successful_txs += 1;

  const flags = inferDexFlags(tx);
  if (flags.is_swap) global.total_swaps += 1;
  if (flags.is_liquidity_add) global.total_liquidity_adds += 1;
  if (flags.is_liquidity_remove) global.total_liquidity_removes += 1;
  if (flags.saw_sync) global.total_sync_events_seen += 1;

  const transfers = extractTransfers(tx);
  global.total_token_transfers += transfers.length;

  const ts = tx.timestamp || tx.block_signed_at || tx?.raw?.block_signed_at || null;
  const txHash = tx.tx_hash || tx.hash || null;

  for (const t of transfers) {
    const contractLc = t.contract ? String(t.contract).toLowerCase() : null;
    if (!contractLc) continue;

    if (!perToken.has(contractLc)) {
      perToken.set(contractLc, {
        contract: contractLc,
        symbol: t.token ?? null,
        decimals: Number.isFinite(+t.decimals) ? +t.decimals : null,
        transfer_count: 0,
        total_amount_in: 0,
        total_amount_out: 0,
        first_seen: ts,
        last_seen: ts,
      });
    }
    const entry = perToken.get(contractLc);
    if (!entry.symbol && t.token) entry.symbol = t.token;
    if (entry.decimals == null && Number.isFinite(+t.decimals)) entry.decimals = +t.decimals;

    entry.transfer_count += 1;
    if (isFiniteNum(t.amount)) {
      // We count both in and out volumes (event-level). If you want wallet-relative
      // direction later, you can add a --wallet filter.
      entry.total_amount_in += t.amount;
      entry.total_amount_out += t.amount;
    }
    if (ts && (!entry.first_seen || ts < entry.first_seen)) entry.first_seen = ts;
    if (ts && (!entry.last_seen || ts > entry.last_seen)) entry.last_seen = ts;

    transfersFlat.push({
      tx_hash: txHash,
      timestamp: ts,
      token: entry.symbol,
      contract: entry.contract,
      decimals: entry.decimals,
      amount: t.amount,
      from: t.from || null,
      to: t.to || null,
      is_swap: flags.is_swap,
      is_liquidity_add: flags.is_liquidity_add,
      is_liquidity_remove: flags.is_liquidity_remove,
      saw_sync: flags.saw_sync,
      success: !!(tx.success === true || tx.successful === true),
    });
  }
}

// ---------- Output ----------
const perTokenArr = Array.from(perToken.values()).sort((a, b) => {
  if (a.symbol && b.symbol && a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
  return a.contract.localeCompare(b.contract);
});

const outStats = { global, per_token: perTokenArr };

const outDir = path.dirname(inputPath);
fs.writeFileSync(path.join(outDir, "transfer_stats.json"), JSON.stringify(outStats, null, 2));
fs.writeFileSync(path.join(outDir, "transfers_flat.json"), JSON.stringify(transfersFlat, null, 2));

console.log("✅ Wrote transfer_stats.json and transfers_flat.json");
 