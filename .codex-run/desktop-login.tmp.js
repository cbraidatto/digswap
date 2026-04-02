const fs = require("fs");
const path = require("path");
const { _electron: electron } = require("playwright");
(async () => {
  const cwd = process.cwd();
  const fixture = JSON.parse(fs.readFileSync(path.join(cwd, "tmp-phase18-smoke.json"), "utf8"));
  const mainScript = path.join(cwd, "apps", "desktop", "out", "main", "index.js");
  const electronBinary = path.join(cwd, "apps", "desktop", "node_modules", "electron", "dist", "electron.exe");
  const env = { ...process.env, DESKTOP_WEB_APP_URL: "http://localhost:3000", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" };
  const app = await electron.launch({ executablePath: electronBinary, args: [mainScript], cwd: path.join(cwd, "apps", "desktop"), env });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.goto("http://localhost:3000/signin", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  await page.fill("input#email", fixture.requesterEmail);
  await page.fill("input#password", fixture.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(feed|onboarding)$/, { timeout: 30000 });
  if (/\/onboarding$/.test(page.url())) {
    await page.waitForURL(/\/feed$/, { timeout: 30000 });
  }
  console.log(JSON.stringify({ ok: true, email: fixture.requesterEmail, url: page.url() }));
  await app.waitForEvent("close");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
