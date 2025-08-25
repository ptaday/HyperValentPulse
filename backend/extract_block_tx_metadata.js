// extract_block_tx_metadata.js  (Node 18+, CommonJS)
const fs = require("fs");
const path = require("path");

// ====== CONFIG ======
const API_KEY ="cqt_rQQgYWtx8YkjDgYtP39PgrRXp9p6"; 
const CHAIN =  "hyperevm-mainnet";
const CSV_FILE = "block_heights_2025-07.csv";
const TAKE_N_BLOCKS = Number(process.env.N_BLOCKS || 10);
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 2000);   // API may cap
const CONCURRENCY = Number(process.env.CONCURRENCY || 1);  // parallel blocks
const OUT_NDJSON = "tx_metadata_100blocks.ndjson";
const OUT_CSV = "tx_summary_100blocks.csv";
// =====================

const options = {
  method: 'GET',
  headers: { Authorization: `Bearer ${API_KEY}` },// body not needed for GET
  body: undefined
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function csvq(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function unwrap(b) { return b && b.data ? b.data : b; }

async function jsonGET(url) {
    console.log("here");
    console.log(url);
    console.log(options);
    const r = await fetch(url, options);
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const body = await res.json();
      const data = body?.data ?? body;
      console.log(data);
      console.log('items:', data.items ? data.items.length : 0);
      console.log('hasMore:', Boolean(data?.links?.next));
    } catch (err) {
      console.error(err);
    }
}

function readTopHeights(csvPath, takeN) {
  const raw = fs.readFileSync(csvPath, "utf-8").trim();
  const lines = raw.split(/\r?\n/);
  const body = lines.slice(1);
  const heights = [];
  for (let i = 0; i < body.length && heights.length < takeN; i++) {
    const first = body[i].split(",")[0];
    const h = Number(first);
    if (Number.isFinite(h)) heights.push(h);
  }
  return heights;
}

// Optional: a simple flag to skip logs on first pass
const NO_LOGS = process.env.NO_LOGS === "true"; // default false

async function fetchBlockPage(blockHeight, page) {
  const noLogsParam = NO_LOGS ? "&no-logs=true" : "";
  console.log("Here");
  const url = `https://api.covalenthq.com/v1/${CHAIN}/block/${blockHeight}/transactions_v3/page/${page}/?no-logs=true&quote-currency=USD`;
  const raw = await jsonGET(url);
  console.log("Here");
  const data = unwrap(raw);
  const items = Array.isArray(data?.items) ? data.items : [];
  const hasMore = Boolean(data?.links?.next);
  if (page === 0) {
    console.log(`   • [debug] items=${items.length} hasMore=${hasMore} ${NO_LOGS ? "(no-logs)" : ""}`);
    if (items.length === 0) console.log("   • [debug] empty first page; block likely has 0 transactions");
  }
  return { items, hasMore };
}

// (optional) Tweak the banner to avoid printing a pageSize for v3
console.log(`🧱 Blocks: ${TAKE_N_BLOCKS}  (concurrency=${CONCURRENCY})`);



function firstExplorerUrl(tx) {
  const exps = Array.isArray(tx.explorers) ? tx.explorers : [];
  return exps.length ? (exps[0].url || "") : "";
}

function flattenLogEvent(le) {
  const params = Array.isArray(le && le.decoded && le.decoded.params) ? le.decoded.params : [];
  const get = (n) => {
    const p = params.find(x => x && typeof x.name === "string" && x.name.toLowerCase() === n);
    return p ? p.value ?? null : null;
  };
  return {
    name: (le && le.decoded && le.decoded.name) || null,
    sender_address: (le && le.sender_address) || null,
    sender_name: (le && le.sender_name) || null,
    sender_symbol: (le && le.sender_contract_ticker_symbol) || null,
    sender_decimals: (le && typeof le.sender_contract_decimals === "number") ? le.sender_contract_decimals : null,
    sender_factory_address: (le && le.sender_factory_address) || null,
    from: get("from"),
    to: get("to"),
    value: get("value")
  };
}

function flattenTx(tx) {
  const logs = Array.isArray(tx.log_events) ? tx.log_events.map(flattenLogEvent) : [];
  return {
    tx_hash: tx.tx_hash,
    block_height: tx.block_height,
    block_hash: tx.block_hash,
    block_signed_at: tx.block_signed_at,
    from_address: tx.from_address,
    from_address_label: tx.from_address_label || null,
    to_address: tx.to_address,
    to_address_label: tx.to_address_label || null,
    value_quote: (typeof tx.value_quote === "number") ? tx.value_quote : null,
    gas_quote: (typeof tx.gas_quote === "number") ? tx.gas_quote : null,
    explorer_url: firstExplorerUrl(tx),
    log_event_count: Array.isArray(tx.log_events) ? tx.log_events.length : 0,
    log_events: logs
  };
}

const totals = { blocks: 0, pages: 0, tx: 0 };

async function scanBlock(blockHeight, sinks) {
  let page = 0, blockTx = 0;
  console.log(`\n▶️  Block ${blockHeight}`);
  while (true) {
    const { items, hasMore } = await fetchBlockPage(blockHeight, page);
    totals.pages += 1;
    console.log(`   • page ${page} -> ${items.length} tx`);
    blockTx += items.length; totals.tx += items.length;

    for (const tx of items) {
      const f = flattenTx(tx);
      sinks.ndjson.write(JSON.stringify(f) + "\n");
      sinks.csv.push([
        csvq(f.block_signed_at),
        csvq(f.block_height),
        csvq(f.tx_hash),
        csvq(f.from_address),
        csvq(f.from_address_label),
        csvq(f.to_address),
        csvq(f.to_address_label),
        csvq(f.value_quote ?? ""),
        csvq(f.gas_quote ?? ""),
        csvq(f.log_event_count),
        csvq(f.explorer_url)
      ].join(","));
    }

    if (!hasMore) break;
    page += 1;
    await sleep(40);
  }
  totals.blocks += 1;
  console.log(`✅ Block ${blockHeight} — ${blockTx} tx`);
  return blockTx;
}

async function mapLimit(list, limit, worker) {
  const results = new Array(list.length);
  let i = 0, inFlight = 0;
  return await new Promise((resolve, reject) => {
    const next = () => {
      if (i === list.length && inFlight === 0) return resolve(results);
      while (inFlight < limit && i < list.length) {
        const idx = i++;
        inFlight++;
        Promise.resolve(worker(list[idx], idx))
          .then(r => { results[idx] = r; inFlight--; next(); })
          .catch(reject);
      }
    };
    next();
  });
}

(async () => {
  console.log(`🔗 Chain: ${CHAIN}`);
  console.log(`📄 Heights CSV: ${path.resolve(CSV_FILE)}`);
  console.log(`🧱 Blocks: ${TAKE_N_BLOCKS}  (concurrency=${CONCURRENCY}, pageSize=${PAGE_SIZE})`);
  console.log(`📝 Outputs: ${OUT_NDJSON}, ${OUT_CSV}`);

  const heights = readTopHeights(CSV_FILE, TAKE_N_BLOCKS);
  if (!heights.length) throw new Error("No heights parsed from CSV");

  const ndjson = fs.createWriteStream(OUT_NDJSON, { flags: "w", encoding: "utf-8" });
  const csvHeader = "ts,block_height,tx_hash,from_address,from_label,to_address,to_label,value_quote,gas_quote,log_event_count,explorer_url";
  const csvRows = [csvHeader];
  const sinks = { ndjson, csv: csvRows };

  const t0 = Date.now();
  await mapLimit(heights, CONCURRENCY, (h) => scanBlock(h, sinks));

  ndjson.end();
  fs.writeFileSync(OUT_CSV, sinks.csv.join("\n") + "\n", "utf-8");

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const rate = (totals.tx / Math.max(1, (Date.now() - t0) / 1000)).toFixed(1);
  console.log(`\n📦 Summary`);
  console.log(`   Blocks: ${totals.blocks}`);
  console.log(`   Pages:  ${totals.pages}`);
  console.log(`   Tx:     ${totals.tx}`);
  console.log(`⏱️  Time:   ${secs}s  (~${rate} tx/s)`);
  console.log(`📝 Wrote:  ${OUT_NDJSON}, ${OUT_CSV}`);
})().catch(err => {
  console.error("❌ Fatal:", err && err.message ? err.message : err);
  process.exit(1);
});