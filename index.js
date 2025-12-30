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

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.goto(SCHEDULE_URL, { waitUntil: "networkidle0" });

  const scheduleText = await page.$eval("#table03", el => el.innerText.trim());
  const newHash = hash(scheduleText);
  const oldHash = read(HASH_FILE);

  console.log("Hash old:", oldHash);
  console.log("Hash new:", newHash);

  // 🔒 LOCK #3 — Content unchanged
  if (oldHash === newHash) {
    console.log("No schedule change — exiting.");
    await browser.close();
    return;
  }

  // 🔒 LOCK #4 — Hard cooldown
  const lastTime = read(TIME_FILE);
  if (lastTime && hoursSince(lastTime) < COOLDOWN_HOURS) {
    console.log("Cooldown active — exiting.");
    await browser.close();
    return;
  }

  const container = await page.$("#container03");
  const screenshot = await container.screenshot({ type: "png" });
  await browser.close();

  write(HASH_FILE, newHash);
  write(TIME_FILE, Date.now());
  write(DATE_FILE, today);

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content: `<@&${ROLE_ID}>`,
      embeds: [
        {
          title: "📅 Stream Schedule Update",
          description:
            "Hot and Fresh Schedule update! Come check it while you can so you never miss your favorite Kat ≽^•⩊•^≼",
          url: SCHEDULE_URL,
          color: 0xe7c2ff,
          image: { url: "attachment://schedule.png" },
        },
      ],
    })
  );

  form.append("file", screenshot, "schedule.png");

  await fetch(WEBHOOK_URL, { method: "POST", body: form });

  console.log("Posted successfully.");
}

run();
