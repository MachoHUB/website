import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PASTEFY_API_KEY = process.env.PASTEFY_API_KEY || "";

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

// ── Brainrot scraper ─────────────────────────────────────────────
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
      const cells = $(row).find("td").map((_, td) => cleanText($(td).text())).get();
      if (cells.length < 2) return;
      const name = cells[0];
      const rarity = cells.find(c => RARITIES.includes(c));
      if (!name || !rarity) return;
      const nameLower = name.toLowerCase();
      if (RARITIES.includes(name) || nameLower.includes("brainrot") || nameLower === "name" || nameLower === "smurf cat") return;
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
setInterval(updateBrainrots, 60 * 60 * 1000);

// ── API Routes ────────────────────────────────────────────────────

app.get("/api/brainrots", (req, res) => res.json(brainrotsData));

app.post("/api/roblox-user",
  rateLimit({ max: 20, windowMs: 60_000, standardHeaders: true, legacyHeaders: false }),
  async (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== "string" || username.trim().length === 0)
      return res.status(400).json({ error: "username is required" });
    const trimmed = username.trim();
    let userId, displayName;
    try {
      const userRes = await axios.post(
        "https://users.roblox.com/v1/usernames/users",
        { usernames: [trimmed], excludeBannedUsers: false },
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
      const match = userRes.data?.data?.[0];
      if (!match) return res.status(404).json({ error: `No Roblox user found with username "${trimmed}"` });
      userId = match.id;
      displayName = match.name;
    } catch (e) {
      if (e.response?.status === 429) return res.status(429).json({ error: "Roblox API rate limited — try again" });
      console.error("roblox-user lookup:", e.message);
      return res.status(500).json({ error: "Roblox API unavailable — try again" });
    }
    let avatarUrl = null;
    try {
      const thumbRes = await axios.get(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`,
        { timeout: 8000 }
      );
      const thumb = thumbRes.data?.data?.[0];
      if (thumb?.state === "Completed" && thumb.imageUrl) avatarUrl = thumb.imageUrl;
    } catch {}
    res.json({ id: userId, name: displayName, avatarUrl });
  }
);

app.post("/api/obfuscate",
  rateLimit({ max: 5, windowMs: 60_000, standardHeaders: true, legacyHeaders: false }),
  async (req, res) => {
    const { script } = req.body;
    if (!script) return res.status(400).json({ error: "script is required" });
    try {
      const r = await axios.post("https://wearedevs.net/api/obfuscate", { script },
        { headers: { "Content-Type": "application/json" }, timeout: 30000 });
      res.json(r.data);
    } catch (e) {
      console.error("obfuscate:", e.message);
      res.status(500).json({ error: "Obfuscation failed" });
    }
  }
);

app.post("/api/pastefy",
  rateLimit({ max: 3, windowMs: 60_000, standardHeaders: true, legacyHeaders: false }),
  async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });
    try {
      const r = await axios.post("https://pastefy.app/api/v2/paste",
        { title: "Logger Create .gg/loggercreate", content, visibility: "UNLISTED", encrypted: false },
        { headers: { "Content-Type": "application/json", ...(PASTEFY_API_KEY ? { Authorization: `Bearer ${PASTEFY_API_KEY}` } : {}) }, timeout: 30000 }
      );
      if (!r.data.paste?.id) return res.status(500).json({ error: "Invalid response from Pastefy" });
      res.json({ raw_url: `https://pastefy.app/${r.data.paste.id}/raw`, paste_id: r.data.paste.id });
    } catch (e) {
      console.error("pastefy:", e.message);
      res.status(500).json({ error: "Failed to upload to Pastefy" });
    }
  }
);

// ── Frontend (API'lardan SONRA olması şart) ───────────────────────
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
