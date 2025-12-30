import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer";
import fetch from "node-fetch";
import pkg from "undici"; // <-- import undici as default
const { FormData, fileFromSync } = pkg; // <-- destructure the functions

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

  // Screenshot schedule container
  const container = await page.$("#container03");
  const screenshotBuffer = await container.screenshot({ type: "png" });
  await browser.close();

  // Save temp file for undici
  const tempFilePath = ".schedule.png";
  fs.writeFileSync(tempFilePath, screenshotBuffer);

  // Update last hash BEFORE posting
  writeLastHash(hash);

  const form = new FormData();
  form.set(
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

  form.set("file", fileFromSync(tempFilePath));

  await fetch(WEBHOOK_URL, { method: "POST", body: form });
  console.log("Posted new schedule version successfully.");

  fs.unlinkSync(tempFilePath);
}

run();
