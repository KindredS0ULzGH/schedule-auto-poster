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

  // Set a wide viewport for crisp high-res screenshot
  await page.setViewport({ width: 1440, height: 2000 });

  await page.goto(PAGE_URL, { waitUntil: "networkidle2" });
  await page.waitForTimeout(2000);

  // Target the schedule container
  const scheduleElement = await page.$("#table03");
  if (!scheduleElement) {
    console.log("Schedule element not found. Exiting.");
    await browser.close();
    return;
  }

  // Get element bounding box and resize viewport if needed
  const box = await scheduleElement.boundingBox();
  await page.setViewport({
    width: Math.ceil(box.width),
    height: Math.ceil(box.height)
  });

  // Take screenshot of the element only
  await scheduleElement.screenshot({ path: IMAGE_PATH });

  await browser.close();

  // Check if schedule has changed
  let oldHash = "";
  if (fs.existsSync("last-schedule-hash.txt")) {
    oldHash = fs.readFileSync("last-schedule-hash.txt", "utf8");
  }

  const newHash = crypto.createHash("md5").u
