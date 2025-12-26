import puppeteer from "puppeteer";
import fetch from "node-fetch";

const WEBHOOK_URL = process.env.WEBHOOK_URL;  
const PAGE_URL = "https://kaikatvt.carrd.co/#schedule";

async function takeScreenshot() {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(PAGE_URL, { waitUntil: "networkidle2" });

  await page.waitForTimeout(2000); // wait for render
  const screenshot = await page.screenshot();

  await browser.close();
  return screenshot;
}

async function sendDiscord(screenshot) {
  const formData = new FormData();
  formData.append("file", screenshot, "schedule.png");
  formData.append(
    "content",
    "**Weekly Schedule Updated!** Check out the new schedule."
  );

  await fetch(WEBHOOK_URL, {
    method: "POST",
    body: formData,
  });
}

export default async function main() {
  try {
    const image = await takeScreenshot();
    await sendDiscord(image);
    console.log("Posted to Discord!");
  } catch (e) {
    console.error("Error", e);
  }
}

main();
