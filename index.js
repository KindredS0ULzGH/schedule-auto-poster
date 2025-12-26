import puppeteer from "puppeteer";
import fetch from "node-fetch";
import fs from "fs";
import FormData from "form-data";
import crypto from "crypto";

const PAGE_URL = "https://kaikatvt.carrd.co/#schedule";
const IMAGE_PATH = "schedule.png";

async function run() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new"
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(PAGE_URL, { waitUntil: "networkidle2" });
  await page.waitForTimeout(2000);

  // Select the schedule container
  const scheduleElement = await page.$("#table03"); // The element ID from your HTML
  if (!scheduleElement) {
    console.log("Schedule element not found. Exiting.");
    await browser.close();
    return;
  }

  // Take a screenshot of just that element
  await scheduleElement.screenshot({ path: IMAGE_PATH });

  await browser.close();

  // Check if schedule has changed
  let oldHash = "";
  if (fs.existsSync("last-schedule-hash.txt")) {
    oldHash = fs.readFileSync("last-schedule-hash.txt", "utf8");
  }

  const newHash = crypto.createHash("md5").update(fs.readFileSync(IMAGE_PATH)).digest("hex");

  if (oldHash === newHash) {
    console.log("Schedule has not changed. Exiting.");
    return;
  }

  fs.writeFileSync("last-schedule-hash.txt", newHash);

  // Send to Discord as embed
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content: "📅 **New Weekly Stream Schedule!**",
      embeds: [
        {
          title: "This Week's Stream Schedule",
          description: "Here is the updated schedule for the week!",
          image: { url: "attachment://schedule.png" },
          color: 0x00ff00
        }
      ]
    })
  );
  form.append("file", fs.createReadStream(IMAGE_PATH), "schedule.png");

  await fetch(process.env.DISCORD_WEBHOOK, { method: "POST", body: form });
  console.log("Posted new schedule to Discord!");
}

run();
