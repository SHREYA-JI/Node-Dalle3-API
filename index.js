import puppeteer from "puppeteer";
import { exec } from "child_process";
import { promisify } from "util";
import express from 'express';

const app = express();
app.set('json spaces', 2);
const PORT = 8080;

class BingApi {
  constructor(options) {
    this.browser = null;
    this.options = options;
  }

  async initialize() {
    if (!this.browser) {
      const { stdout: chromiumPath } = await promisify(exec)("which chromium");

      this.browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: chromiumPath.trim(),
      });
    }
  }

  async setCookieAndReload(page) {
    const cookie = { "name": "_U", "value": this.options.cookie };
    await page.setCookie(cookie);
    await page.reload();
  }

  async createImage(query) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.initialize();

        if (!this.browser) {
          reject("Browser not launched");
          return;
        }

        const page = await this.browser.newPage();
        await page.goto(`https://www.bing.com/images/create`, {
          waitUntil: "networkidle2"
        });
        await this.setCookieAndReload(page);

        try {
          await page.waitForSelector("#bnp_btn_accept");
          await page.click("#bnp_btn_accept");
        } catch (e) {
          console.log("Accept button not found, continuing...");
        }

        await page.focus("#sb_form_q");
        await page.keyboard.type(query);
        await page.keyboard.press("Enter");

        await page.waitForSelector(".imgpt", {
          timeout: this.options.timeout || 1e3 * 60
        });

        const res = await page.$$eval(".imgpt", (imgs) => {
          return imgs.map((img) => {
            return img.querySelector("img")?.getAttribute("src");
          });
        });

        const urls = res.map((url) => {
          return url?.split("?")[0];
        });

        await page.close();
        resolve({ urls });
      } catch (error) {
        reject(error);
      }
    });
  }

  async close() {
    return new Promise(async (resolve) => {
      if (this.browser) {
        await this.browser.close();
      }
      resolve();
    });
  }
}

const bing = new BingApi({
  cookie: "1Oa-lvcQNooxB5xj9ZcNNVmYDFmZeF69zhc1847LPkW_5KFgqduVuGy9iz20S4CXlmVMNxweceKjB3tcQaKCgAAIKbriQcQ-_T-LUehblRlGS6mQIqDcP6hrUkUIpxIuPYl_ZeJNsao7mK1X98u1hiabvknrXuk61qejw830bvl3BVNHx46Q4ijkRbLYOiHwxTG5XMSkWjC0Wd_9IE32w3GqPA4zZe5jCC5Gi475aztg",
});

app.get('/g', async (req, res) => {
  const prompt = req.query.prompt;

  try {
    console.log(`sending a request to bing`);
    const result = await bing.createImage(prompt);
    console.log(result.urls);
    res.json({ urls: result.urls });
  } catch (error) {
    console.error('Error generating images:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    
  } catch (error) {
    console.error('An error occurred:', error);
  }
});