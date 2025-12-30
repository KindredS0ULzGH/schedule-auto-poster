import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer";
import fetch from "node-fetch";
import FormData from "form-data";

const SCHEDULE_URL = "https://kaikatvt.carrd.co/#schedule";
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK;
const ROLE_ID = "1353762877705682984";

const HASH_FILE = ".last_schedule_hash.txt";
const TIME_FILE = ".last_post_time.txt";

const COOLDOWN_HOURS = 12;

function getHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function readFileSafe(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : null;
}

function hoursSince(timestamp) {
  return (Date.now() - Number(timestamp)) / (1000 * 60 * 60);
}

async function run() {
  console.log("Launching browser…");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2, // 👈 sharper screenshot
  });

  a
