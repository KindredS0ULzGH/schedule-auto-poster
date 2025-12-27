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
  await page.goto(PAGE_URL, { waitUntil: "networkidle2" });

  // Wait 2 seconds for animations/images
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Select the schedule container
  const scheduleElement = await page.$("#table03");
  if (!scheduleElement) {
    console.log("Schedule element not found. Exiting.");
    await browser.close();
    return;
  }

  // Get element size
  const box = await scheduleElement.boundingBox();

  // Set viewport to element size with high resolution
  const deviceScaleFactor = 2; // doubles pixel density
  await page.setViewport({
    width: Math.ceil(box.width),
    height: Math.ceil(box.height),
    deviceScaleFactor
  });

  // Screenshot only the element in high resolution
  await scheduleElement.screenshot({ 
    path: IMAGE_PATH, 
    type: "png", 
    omitBackground: false 
  });
  await browser.close();

  // Check if schedule has changed
  let oldHash = "";
  if (fs.existsSync("last-schedule-hash.txt")) {
    oldHash = fs.readFileSync("last-schedule-hash.txt", "utf8");
  }

  const newHash = crypto
    .createHash("md5")
    .update(fs.readFileSync(IMAGE_PATH))
    .digest("hex");

  if (oldHash === newHash) {
    console.log("Schedule has not changed. Exiting.");
    return;
  }

  fs.writeFileSync("last-schedule-hash.txt", newHash);

  // Send to Discord
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content: "<null> 📅 ** New Week, New Stream Schedule!**",
      embeds: [
        {
          title: "This Week's Stream Schedule",
          url: PAGE_URL, // clickable title
          description: "Hot and Fresh Schedule update! Come check it while you can so you never miss your favorite Kat ≽^•⩊•^≼",
          color: 0xE7C2FF,
          image: {
            url: "attachment://schedule.png"
          }
        }
      ]
    })
  );
  form.append("file", fs.createReadStream(IMAGE_PATH), "schedule.png");

  await fetch(process.env.DISCORD_WEBHOOK, { method: "POST", body: form });
  console.log("Posted new schedule to Discord!");
}

run();
