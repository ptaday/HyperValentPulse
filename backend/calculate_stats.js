// calculate_stats.js
// Run: node calculate_stats.js
// Input : ultimate_display.json  (your merged file: tx + model_output)
// Output: statistics.json        (overall stats + per-token breakdown + final verdict)

const fs = require("fs");
const path = require("path");

const INPUT_PATH = path.resolve(__dirname, "llm_answers.json");
const OUTPUT_PATH = path.resolve(__dirname, "statistics.json");

function normalizeClass(c) {
  if (!c) return "Unknown";
  const s = String(c).trim().toLowerCase();
  if (s === "bullish") return "Bullish";
  if (s === "bearish") return "Bearish";
  if (s === "neutral") return "Neutral";
  return "Unknown";
}

function safePct(n, d) {
  return d ? +((n / d) * 100).toFixed(2) : 0;
}

function add(map, key, v = 1) {
  const k = key || "(unknown)";
  map[k] = (map[k] || 0) + v;
}

function ensureTokenBucket(obj, token) {
  const k = token || "(unknown)";
  if (!obj[k]) obj[k] = { Bullish: 0, Bearish: 0, Neutral: 0, Unknown: 0, total: 0 };
  return obj[k];
}

function main() {
  const rows = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8"));
  const N = rows.length;

  // Overall tallies
  const counts = { Bullish: 0, Bearish: 0, Neutral: 0, Unknown: 0 };
  const amountsByClass = { Bullish: 0, Bearish: 0, Neutral: 0, Unknown: 0 };

  // Token summaries
  const tokenCountMap = {};                // token -> total count
  const tokenAmountMap = {};               // token -> total amount (native units)
  const tokenClassCounts = {};             // token -> {Bullish, Bearish, Neutral, Unknown, total}
  const tokenClassAmounts = {};            // token -> {Bullish, Bearish, Neutral, Unknown, total}

  for (const r of rows) {
    const cls = normalizeClass(r.model_output?.classification);
    counts[cls]++;

    const token = r.input_transaction?.token || r.token || "(unknown)";
    const amt = typeof r.input_transaction?.amount === "number" ? r.input_transaction.amount : 0;

    // Per-class totals (overall)
    amountsByClass[cls] += amt;

    // Token totals
    add(tokenCountMap, token, 1);
    tokenAmountMap[token] = (tokenAmountMap[token] || 0) + amt;

    // Per-token class counts
    const bucketCounts = ensureTokenBucket(tokenClassCounts, token);
    bucketCounts[cls] += 1;
    bucketCounts.total += 1;

    // Per-token class amounts
    const bucketAmts = ensureTokenBucket(tokenClassAmounts, token);
    bucketAmts[cls] += amt;
    bucketAmts.total += amt;
  }

  // Percentages overall
  const percentages = {
    Bullish: safePct(counts.Bullish, N),
    Bearish: safePct(counts.Bearish, N),
    Neutral: safePct(counts.Neutral, N),
    Unknown: safePct(counts.Unknown, N),
  };

  // Final verdict (only Bullish vs Bearish)
  const bbTotal = counts.Bullish + counts.Bearish;
  const bearishShare = safePct(counts.Bearish, bbTotal);
  const bullishShare = safePct(counts.Bullish, bbTotal);
  let verdict = "No verdict";
  if (bbTotal === 0) {
    verdict = "No verdict";
  } else if (bearishShare > bullishShare) {
    verdict = "Bearish";
  } else if (bullishShare > bearishShare) {
    verdict = "Bullish";
  } else {
    verdict = "Tie";
  }

  // Sort helpers (descending)
  const sortEntriesDesc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

  // Build final stats object
  const stats = {
    sample_size: N,

    classification: {
      counts,
      percentages
    },

    // Overall amounts summed from input_transaction.amount (native units per token)
    amounts_by_class: {
      Bullish: +amountsByClass.Bullish.toFixed(8),
      Bearish: +amountsByClass.Bearish.toFixed(8),
      Neutral: +amountsByClass.Neutral.toFixed(8),
      Unknown: +amountsByClass.Unknown.toFixed(8)
    },

    // Verdict on market tilt using only Bullish vs Bearish
    final_verdict: {
      bullish_count: counts.Bullish,
      bearish_count: counts.Bearish,
      bullish_share_pct: bullishShare, // % of Bullish among (Bullish+Bearish)
      bearish_share_pct: bearishShare, // % of Bearish among (Bullish+Bearish)
      considered_total: bbTotal,
      verdict // "Bullish" | "Bearish" | "Tie" | "No verdict"
    },

    // Unique tokens map with counts (appearance frequency)
    unique_tokens_seen: tokenCountMap,

    // Total amounts per token (native units)
    token_amounts: Object.fromEntries(
      Object.entries(tokenAmountMap).map(([t, v]) => [t, +v.toFixed(8)])
    ),

    // Per-token breakdown by classification (counts)
    token_classification_counts: tokenClassCounts,

    // Per-token breakdown by classification (amounts, native units)
    token_classification_amounts: Object.fromEntries(
      Object.entries(tokenClassAmounts).map(([t, o]) => ([
        t,
        {
          Bullish: +o.Bullish.toFixed(8),
          Bearish: +o.Bearish.toFixed(8),
          Neutral: +o.Neutral.toFixed(8),
          Unknown: +o.Unknown.toFixed(8),
          total: +o.total.toFixed(8)
        }
      ]))
    ),

    // Convenience views (top tokens)
    top_tokens_by_count: sortEntriesDesc(tokenCountMap).slice(0, 20)
      .map(([token, count]) => ({ token, count })),

    top_tokens_by_amount: sortEntriesDesc(tokenAmountMap).slice(0, 20)
      .map(([token, amount]) => ({ token, amount: +amount.toFixed(8) })),

    notes: [
      "Final verdict compares only Bearish vs Bullish counts; Neutral/Unknown are ignored for this ratio.",
      "Amounts are in native token units (from `input_transaction.amount`).",
      "Percentages in classification are based on total transactions (including Neutral/Unknown)."
    ]
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(stats, null, 2), "utf-8");
  console.log(`Wrote statistics -> ${OUTPUT_PATH}`);
}

main();
