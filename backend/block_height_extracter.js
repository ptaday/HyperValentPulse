// get_block_heights.js
const fs = require("fs");

const API_KEY = "cqt_rQQgYWtx8YkjDgYtP39PgrRXp9p6"; 
const CHAIN = "hyperevm-mainnet";
const START_DATE = "2025-07-30";   // inclusive
const END_DATE   = "2025-07-31";   // exclusive
const PAGE_SIZE  = 5000;           // large but safe
const OUT_FILE   = "block_heights_2025-07.csv";

function unwrap(resp) {
  // Covalent usually returns { data: {...}, error: false }
  return resp && typeof resp === "object" && resp.data ? resp.data : resp;
}

async function fetchPage(pageNumber) {
  const url = `https://api.covalenthq.com/v1/${CHAIN}/block_v2/${START_DATE}/${END_DATE}/` +
              `?page-number=${pageNumber}&page-size=${PAGE_SIZE}`;
  const r = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    const err = new Error(`HTTP ${r.status} ${r.statusText} – ${txt}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

async function fetchPageWithRetry(pageNumber, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  try {
    return await fetchPage(pageNumber);
  } catch (e) {
    const status = e.status || 0;
    const transient = status === 429 || (status >= 500 && status < 600);
    if (transient && attempt < MAX_ATTEMPTS) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s,2s,4s,8s
      console.warn(`[warn] Page ${pageNumber} failed (attempt ${attempt}/${MAX_ATTEMPTS}) – ${e.message}`);
      console.warn(`[warn] Backing off ${delayMs}ms then retrying...`);
      await new Promise(res => setTimeout(res, delayMs));
      return fetchPageWithRetry(pageNumber, attempt + 1);
    }
    console.error(`[error] Page ${pageNumber} failed: ${e.message}`);
    throw e;
  }
}

async function run() {
  console.log(`Starting export for ${CHAIN} from ${START_DATE} to ${END_DATE}`);
  console.log(`Page size: ${PAGE_SIZE}  | Output: ${OUT_FILE}`);

  // Prepare output and write header once
  const stream = fs.createWriteStream(OUT_FILE, { flags: "w", encoding: "utf-8" });
  stream.write("height,signed_at\n");

  let page = 0;
  let totalRows = 0;
  let startedAt = Date.now();

  while (true) {
    console.log(`\n[info] Fetching page ${page}...`);
    const raw = await fetchPageWithRetry(page);
    const data = unwrap(raw);

    if (page === 0) {
      console.log("[debug] keys at top:", Object.keys(raw || {}));
      console.log("[debug] keys under data:", Object.keys(data || {}));
      console.log("[debug] chain_name:", data?.chain_name);
      console.log("[debug] pagination:", data?.pagination);
    }

    const items = data?.items || [];
    console.log(`[info] Received ${items.length} items on page ${page}`);

    // Write each row as "height,signed_at"
    for (const b of items) {
      const h = b?.height;
      const t = b?.signed_at;
      if (Number.isInteger(h) && typeof t === "string") {
        stream.write(`${h},${t}\n`);
        totalRows++;
      }
    }

    const hasMore = data?.pagination?.has_more === true;
    console.log(`[info] has_more=${hasMore} | totalRowsSoFar=${totalRows}`);

    if (!hasMore) break;
    page += 1;

    // (Optional) tiny pacing between pages to be gentle on rate limits
    await new Promise(res => setTimeout(res, 100));
  }

  stream.end();

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✅ Done. Wrote ${totalRows} rows to ${OUT_FILE} in ${seconds}s`);
}

run().catch((e) => {
  console.error("Fatal error:", e?.message || e);
  process.exit(1);
});