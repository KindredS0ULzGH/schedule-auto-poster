import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer";
import fetch from "node-fetch";
import FormData from "form-data";

const SCHEDULE_URL = "https://kaikatvt.carrd.co/#schedule";
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK;
const ROLE_ID = "1353762877705682984";

const LAST_HASH_FILE = ".last_posted_hash.txt";

function getHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function readLastHash() {
  return fs.existsSync(LAST_HASH_FILE)
    ? fs.readFileSync(LAST_HASH_FILE, "utf8")
    : null;
}

function writeLastHash(hash) {
  fs.writeFileSync(LAST_HASH_FILE, hash);
}

async function run() {
  console.log("Checking schedule...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.goto(SCHEDULE_URL, { waitUntil: "networkidle0" });

  // Grab schedule text for hash comparison
  const scheduleText = await page.$eval("#table03", el => el.innerText.trim());
  const hash = getHash(scheduleText);
  const lastHash = readLastHash();

  console.log("Current hash:", hash);
  console.log("Last posted hash:", lastHash);

  if (hash === lastHash) {
    console.log("No change from the most recent posted schedule — exiting.");
    await browser.close();
    return;
  }

  // Take screenshot of schedule container
  const container = await page.$("#container03");
  const screenshot = await container.screenshot({ type: "png" });
  await browser.close();

  // Update last hash BEFORE posting to prevent duplicate posts
  writeLastHash(hash);

  // Convert screenshot buffer to Blob for form-data
  const blob = new Blob([screenshot], { type: "image/png" });

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

  form.append("file", blob, "schedule.png");

  await fetch(WEBHOOK_URL, { method: "POST", body: form });
  console.log("Posted new schedule version successfully.");
}

run();
