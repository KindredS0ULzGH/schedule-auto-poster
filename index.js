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
const DATE_FILE = ".last_post_date.txt";

const COOLDOWN_HOURS = 12;

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : null;
}

function write(path, value) {
  fs.writeFileSync(path, value.toString());
}

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function hoursSince(ts) {
  return (Date.now() - Number(ts)) / (1000 * 60 * 60);
}

// EST-safe date + weekday
function getEST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

async function run() {
  const nowEST = getEST();
  const weekday = nowEST.getDay(); // 3 = Wednesday
  const today = nowEST.toISOString().split("T")[0];

  console.log("EST Date:", today, "Weekday:", weekday);

  // 🔒 LOCK #1 — Wednesday only
  if (weekday !== 3) {
    console.log("Not Wednesday — exiting.");
    return;
  }

  // 🔒 LOCK #2 — Already posted today
  if (read(DATE_FILE) === today) {
    console.log("Already posted today — exiting.");
    return;
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page =
