import puppeteer from "puppeteer";
import fetch from "node-fetch";
import fs from "fs";

const PAGE_URL = "https://kaikatvt.carrd.co/#schedule";
const IMAGE_PATH = "schedule.png";

async function run() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new"
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(PAGE_URL, { waitUntil: "networkidle2" });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: IMAGE_PATH });
  await browser.close();

  const form = new FormData();
  form.append("content", "**📅 New Weekly Stream Schedule**");
  form.append("file", fs.createReadStream(IMAGE_PATH));

  await fetch(process.env.DISCORD_WEBHOOK, {
    method: "POST",
    body: form
  });
}

run();
