import fs from "fs";
import crypto from "crypto";
import puppeteer from "puppeteer";
import FormData from "form-data"; // use form-data package
import fetch from "node-fetch";

const SCHEDULE_URL = "https://kaikatvt.carrd.co/#schedule";
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK;
const ROLE_ID = "1353762877705682984";
const LAST_HASH_FILE = ".last_posted_hash.txt";

// ...hash functions remain the same...

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
  const hash = crypto.createHash("sha256").update(scheduleText).digest("hex");
  const lastHash = fs.existsSync(LAST_HASH_FILE)
    ? fs.readFileSync(LAST_HASH_FILE, "utf8")
    : null;

  console.log("Current hash:", hash);
  console.log("Last posted hash:", lastHash);

  if (hash === lastHash) {
    console.log("No change from last post — exiting.");
    await browser.close();
    return;
  }

  // Screenshot
  const container = await page.$("#container03");
  const screenshotBuffer = await container.screenshot({ type: "png" });
  await browser.close();

  fs.writeFileSync(".schedule.png", screenshotBuffer);

  // Update last hash
  fs.writeFileSync(LAST_HASH_FILE, hash);

  // Use form-data
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
  form.append("file", fs.createReadStream(".schedule.png"));

  await fetch(WEBHOOK_URL, { method: "POST", body: form });
  console.log("Posted new schedule successfully.");

  fs.unlinkSync(".schedule.png");
}

run();
