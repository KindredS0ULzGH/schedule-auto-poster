import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer-core";
import FormData from "form-data";
import fetch from "node-fetch";

const SCHEDULE_URL = "https://kaikatvt.carrd.co/#schedule";
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK;
const ROLE_ID = "s";
const HASH_FILE = ".last_posted_hash.txt";

// Ensure hash file exists
if (!fs.existsSync(HASH_FILE)) fs.writeFileSync(HASH_FILE, "");

function getHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function readLastHash() {
  return fs.existsSync(HASH_FILE) ? fs.readFileSync(HASH_FILE, "utf8") : null;
}

function writeLastHash(hash) {
  fs.writeFileSync(HASH_FILE, hash);
}

async function run() {
  console.log("Checking schedule...");

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({
    width: 3840,
    height: 2160,
    deviceScaleFactor: 3
  });

  await page.goto(SCHEDULE_URL, { waitUntil: "networkidle0" });

  // Get schedule table text only
  const scheduleText = await page.$eval("#table03 table", el => el.innerText.trim());
  const hash = getHash(scheduleText);
  const lastHash = readLastHash();

  console.log("Current hash:", hash);
  console.log("Last posted hash:", lastHash);

  if (hash === lastHash) {
    console.log("No change from last post — exiting.");
    await browser.close();
    return;
  }

  // Screenshot only the 7-day schedule table
  const table = await page.$("#table03 table");
  await page.evaluate(el => el.scrollIntoView(), table);
  await new Promise(r => setTimeout(r, 2000));

  const box = await table.boundingBox();
  const screenshotBuffer = await page.screenshot({
    type: "png",
    clip: {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height)
    },
    omitBackground: true,
    encoding: "binary"
  });

  fs.writeFileSync(".schedule.png", screenshotBuffer);
  await browser.close();

  // Update hash locally
  writeLastHash(hash);

  // Send Discord webhook
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content: `<@&${ROLE_ID}>📅 **A Schedule Update is here!**`,
      embeds: [
        {
          title: "📅 Stream Schedule Update",
          description:
            "Hot and Fresh Schedule update! Come check it while you can so you never miss your favorite Kat ≽^•⩊•^≼",
          url: SCHEDULE_URL,
          color: 0xe7c2ff,
          image: { url: "attachment://schedule.png" }
        }
      ]
    })
  );
  form.append("file", fs.createReadStream(".schedule.png"));

  await fetch(WEBHOOK_URL, { method: "POST", body: form });
  console.log("Posted new schedule successfully.");
}

run();
