// Requires Node.js 18+ (built-in fetch). Run: node classify_transfers.js
const fs = require("fs");
const path = require("path");

const INPUT_PATH = path.resolve(__dirname, "transfers_flat.json");
const OUTPUT_PATH = path.resolve(__dirname, "llm_answers.json");

// Make model configurable via env, fallback to your tag
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:latest";
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || "http://localhost:11434/api/generate";

// Base prompt (without the transaction appended)
const PROMPT_BASE =
  "Role: You are a blockchain market analyst. Your expertise is in interpreting raw transaction metadata " +
  "and evaluating its potential impact on market sentiment.\n\n" +
  "Task: Analyze the following transaction (all token amounts are in native units unless otherwise noted). " +
  'Classify it into exactly one of: "bullish", "bearish", or "neutral".\n\n' +
  "Output format: Return a single compact JSON object:\n" +
  "{\n" +
  '  "classification": "<bullish|bearish|neutral>",\n' +
  '  "reasoning": "1–3 sentences explaining the classification based on signals in the metadata",\n' +
  '  "market_impact": "Brief note on potential effect (e.g., buy pressure, liquidity depth change, negligible)"\n' +
  "}\n\n" +
  "Guidelines:\n" +
  "- Bullish → large buys, liquidity adds, whale accumulation, exchange withdrawals, stable→volatile rotations.\n" +
  "- Bearish → large sells, liquidity removals, whale distributions, deposits to exchanges, volatile→stable rotations.\n" +
  "- Neutral → small/insignificant transfers, internal shuffles, maintenance, or events unlikely to impact sentiment.\n\n" +
  "The Transaction:\n";

function readInputFlexible(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) return JSON.parse(raw); // JSON array

  // NDJSON
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        console.warn(`Skipping invalid JSON on line ${i + 1}: ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

async function callOllama(model, prompt) {
  const body = {
    model,
    prompt,
    stream: false,
    // Ask Ollama to produce JSON; we'll still parse defensively.
    format: "json",
    keep_alive: "30m",
    options: { temperature: 0.2 },
  };

  const res = await fetch(OLLAMA_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Ollama HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.response || "";
}

function coerceToJSON(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) {}
  }
  return { raw_response: trimmed };
}

function safeGetTxHash(tx) {
  return tx?.tx_hash || tx?.hash || null;
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

async function main() {
  console.log(`Model: ${OLLAMA_MODEL}`);
  console.log(`Endpoint: ${OLLAMA_ENDPOINT}`);
  console.log(`Reading: ${INPUT_PATH}`);

  const items = readInputFlexible(INPUT_PATH);
  console.log(`Found ${items.length} transactions`);

  const results = [];

  for (let i = 0; i < items.length; i++) {
    const tx = items[i];
    const txJson = JSON.stringify(tx, null, 2);
    const fullPrompt = PROMPT_BASE + txJson;

    const idxHuman = i + 1;
    process.stdout.write(`\n[${idxHuman}/${items.length}] Querying model for tx... `);

    try {
      const responseText = await callOllama(OLLAMA_MODEL, fullPrompt);
      const parsed = coerceToJSON(responseText);

      const txHash = safeGetTxHash(tx);
      const classification = parsed?.classification || "n/a";

      // ---- PRINT RESPONSES TO CONSOLE ----
      console.log("done.");
      console.log(`• tx_hash: ${txHash ?? "(unknown)"} | classification: ${classification}`);
      console.log("• full model_output:");
      console.log(pretty(parsed));

      results.push({
        index: i,
        tx_hash: txHash,
        input_transaction: tx,
        model_output: parsed,
      });
    } catch (err) {
      console.error("error.");
      console.error(`Error on item ${i}: ${err.message}`);

      results.push({
        index: i,
        tx_hash: safeGetTxHash(tx),
        input_transaction: tx,
        error: err.message,
      });
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nSaved ${results.length} results to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
