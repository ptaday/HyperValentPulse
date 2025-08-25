// Node 18+ (native fetch)
// Save as fetch_hyperevm_blocks_with_logs.js
const fs = require("fs");

// --- Config ---
const COVALENT_API_KEY = process.env.COVALENT_API_KEY || "cqt_rQQgYWtx8YkjDgYtP39PgrRXp9p6"; // set env var
if (!COVALENT_API_KEY) {
  console.error("❌ Set COVALENT_API_KEY env var.");
  process.exit(1);
}

const CHAIN = "hyperevm-mainnet";          // Valid Covalent chain slug for HyperEVM
const START_DATE = "2025-07-30";
const END_DATE   = "2025-07-31";
const TARGET_BLOCK_COUNT = 500;
const PAGE_SIZE = 100;                      // block_v2 supports page-size + page-number
const OUTPUT_FILE = "transaction_500_blocks_with_logs_and_metadata.json";

// Tune these based on your plan: free ~4 RPS, premium up to 50 RPS.
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const MAX_RETRIES = 3;

// --- Utils ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Exponential backoff with jitter; respects Retry-After when present */
const fetchWithRetry = async (url, {retries = MAX_RETRIES, baseDelay = 750} = {}) => {
  const headers = {
    "Authorization": `Bearer ${COVALENT_API_KEY}`,
    "User-Agent": "hyperevm-scraper/1.1"
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        // Respect Retry-After on 429/503
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const ra = res.headers.get("retry-after");
          const waitMs = ra
            ? (isNaN(Number(ra)) ? Math.max(0, new Date(ra) - Date.now()) : Number(ra) * 1000)
            : baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
          console.warn(`⚠️ ${res.status} on ${url}. Backing off ${waitMs}ms (attempt ${attempt + 1}/${retries}).`);
          await sleep(waitMs);
          continue;
        }
        // Surface body for debugging
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 500)}`);
      }
      const json = await res.json();
      if (json.error) throw new Error(`Covalent API Error: ${json.error_message || "unknown"}`);
      return json.data;
    } catch (err) {
      if (attempt === retries) throw err;
      const waitMs = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      console.warn(`⚠️ Network/error on ${url}. Retrying in ${waitMs}ms. ${err.message}`);
      await sleep(waitMs);
    }
  }
};

/** Simple concurrency-limited mapper (no deps) */
async function mapWithConcurrency(items, mapper, limit = CONCURRENCY) {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Fetch block headers across pages until you have TARGET_BLOCK_COUNT */
const fetchBlocks = async () => {
  let all = [];
  let hasMore = true;
  let pageNumber = 0;

  console.log(`Fetching up to ${TARGET_BLOCK_COUNT} block headers from ${START_DATE}..${END_DATE} ...`);
  while (all.length < TARGET_BLOCK_COUNT && hasMore) {
    const url = `https://api.covalenthq.com/v1/${CHAIN}/block_v2/${START_DATE}/${END_DATE}/?page-size=${PAGE_SIZE}&page-number=${pageNumber}`;
    const data = await fetchWithRetry(url);

    const items = data?.items || [];
    if (items.length === 0) break;

    all.push(...items);
    hasMore = Boolean(data?.pagination?.has_more);
    pageNumber = (data?.pagination?.page_number ?? pageNumber) + 1;

    console.log(`  Page ${pageNumber}: total blocks ${all.length} | has_more=${hasMore}`);
  }

  // Dedupe by height (defensive) and trim
  const seen = new Set();
  const unique = [];
  for (const b of all) {
    if (!seen.has(b.height)) {
      seen.add(b.height);
      unique.push(b);
    }
  }

  return unique.slice(0, TARGET_BLOCK_COUNT);
};

/** Extract handy metadata from a tx's logs */
function analyzeLogs(logEvents = []) {
  const transfers = [];
  const dexFlags = {
    is_swap: false,
    is_liquidity_add: false,
    is_liquidity_remove: false,
    saw_sync: false,
  };

  for (const ev of logEvents) {
    const decoded = ev.decoded || null;
    const name = decoded?.name || ev.raw_log_topic_0_name || null;

    // Transfers (ERC-20)
    // Covalent often provides sender_contract_ticker_symbol/decimals and decoded params
    if (decoded && decoded.name === "Transfer") {
      const params = decoded.params || [];
      const from = params.find(p => p.name === "from")?.value || null;
      const to = params.find(p => p.name === "to")?.value || null;
      const valueParam = params.find(p => p.name === "value")?.value;
      const amountRaw = (typeof valueParam === "string" || typeof valueParam === "number") ? valueParam : null;

      transfers.push({
        token: ev.sender_contract_ticker_symbol || null,
        contract: ev.sender_contract_address || ev.sender_address || null,
        decimals: ev.sender_contract_decimals ?? null,
        from,
        to,
        amount_raw: amountRaw ?? null,
        // normalized amount if decimals known
        amount: (amountRaw != null && ev.sender_contract_decimals != null)
          ? String(Number(amountRaw) / Math.pow(10, ev.sender_contract_decimals))
          : null
      });
    }

    // Common AMM events (UniswapV2/V3 style & cousins)
    // Pair: Swap/Mint/Burn/Sync
    if (decoded && typeof decoded.name === "string") {
      const n = decoded.name.toLowerCase();
      if (n === "swap") dexFlags.is_swap = true;
      if (n === "mint") dexFlags.is_liquidity_add = true;
      if (n === "burn") dexFlags.is_liquidity_remove = true;
      if (n === "sync") dexFlags.saw_sync = true;

      // A few extras seen across routers/pools
      if (n.includes("swap")) dexFlags.is_swap = true;
      if (n.includes("mint")) dexFlags.is_liquidity_add = true;
      if (n.includes("burn")) dexFlags.is_liquidity_remove = true;
      if (n.includes("sync")) dexFlags.saw_sync = true;
    }
  }

  return { transfers, dexFlags };
}

/** Fetch all transactions for a single block (v3 pagination by page index) with logs included */
const fetchTransactionsForBlock = async (blockHeight) => {
  const all = [];
  let page = 0;
  while (true) {
    // IMPORTANT: include logs
    const url = `https://api.covalenthq.com/v1/${CHAIN}/block/${blockHeight}/transactions_v3/page/${page}/?no-logs=false&quote-currency=USD`;
    const data = await fetchWithRetry(url);

    const items = data?.items || [];
    if (items.length === 0) {
      if (page === 0) console.log(`  ℹ️ Block ${blockHeight} has 0 txs`);
      break;
    }
    all.push(...items);

    // v3 uses fixed 100/page; advance while `links.next` is present or if we got a full page.
    const hasNext = data?.links?.next != null || items.length === 100;
    if (!hasNext) break;
    page++;
  }
  return all;
};

// --- Main ---
(async () => {
  try {
    const blocks = await fetchBlocks();
    if (blocks.length === 0) {
      console.log("No blocks in the given date range.");
      return;
    }
    console.log(`✅ Got ${blocks.length} distinct block headers.`);

    console.log(`🚦 Fetching transactions (with logs) with concurrency=${CONCURRENCY} ...`);
    const txArrays = await mapWithConcurrency(
      blocks,
      async (b) => {
        try { return await fetchTransactionsForBlock(b.height); }
        catch (e) { console.error(`❌ Block ${b.height} failed: ${e.message}`); return []; }
      },
      CONCURRENCY
    );

    const finalData = txArrays.flat().map(tx => {
      // Some fields Covalent commonly returns on tx v3 items:
      // tx_hash, block_hash, block_height, block_signed_at, successful,
      // from_address, to_address, value, value_quote, gas_offered, gas_spent, gas_price, fees_paid, explorers, method, log_events[]
      const method = tx.method ? {
        name: tx.method?.name ?? null,
        signature: tx.method?.signature ?? null
      } : null;

      const { transfers, dexFlags } = analyzeLogs(tx.log_events || []);

      return {
        tx_hash: tx.tx_hash,
        block_hash: tx.block_hash,
        block_height: tx.block_height,
        timestamp: tx.block_signed_at,
        success: Boolean(tx.successful),
        from_address: tx.from_address,
        to_address: tx.to_address,
        to_address_label: tx.to_address_label || null,
        native_value: tx.value,                 // raw wei-style (string/number as provided)
        value_quote: tx.value_quote ?? null,    // USD quote if provided by Covalent
        gas_offered: tx.gas_offered ?? null,
        gas_spent: tx.gas_spent ?? null,
        gas_price: tx.gas_price ?? null,
        fees_paid: tx.fees_paid ?? null,        // often gas_spent * gas_price (raw units)
        signer: tx.signer || null,
        method,
        dex_flags: dexFlags,
        token_transfers: transfers,
        block_explorer_url: Array.isArray(tx.explorers) && tx.explorers[0] ? tx.explorers[0].url : null,

        // Keep the raw object (with logs + decoded params) for downstream, so you don't lose anything.
        raw: tx
      };
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
    console.log(`🎉 Wrote ${finalData.length} transactions (with logs + metadata) to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error(`\n🔥 Unhandled: ${err.message}`);
    process.exit(1);
  }
})();
