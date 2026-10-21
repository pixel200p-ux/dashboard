import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { resolve } from "node:path";
import { createServer } from "vite";

/** @type {import("vite").ViteDevServer | undefined} */
let vite;
/** @type {typeof import("../src/lib/pixel-prompt").portfolioCategoriesForPrompt} */
let portfolioCategoriesForPrompt = () => {
  throw new Error("Pixel prompt helpers were not loaded.");
};
/** @type {typeof import("../src/lib/pixel-prompt").portfolioPromptForFollowup} */
let portfolioPromptForFollowup = () => {
  throw new Error("Pixel prompt helpers were not loaded.");
};
/** @type {typeof import("../src/engine/dates").isValidYmd} */
let isValidYmd = () => {
  throw new Error("Date helpers were not loaded.");
};

before(async () => {
  vite = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    resolve: { alias: { "@": resolve(process.cwd(), "src") } },
    server: { middlewareMode: true },
  });
  ({ portfolioCategoriesForPrompt, portfolioPromptForFollowup } =
    await vite.ssrLoadModule("/src/lib/pixel-prompt.ts"));
  ({ isValidYmd } = await vite.ssrLoadModule("/src/engine/dates.ts"));
});

after(async () => {
  await vite?.close();
});

test("Vietnamese portfolio prompts retain intent after normalization", () => {
  assert.deepEqual(portfolioCategoriesForPrompt("Tôi đang giữ gì?"), null);
  assert.deepEqual(portfolioCategoriesForPrompt("Tôi muốn đầu tư tiền số"), ["CRYPTO"]);
  assert.deepEqual(portfolioCategoriesForPrompt("Tình hình lãi/lỗ danh mục thế nào?"), null);
});

test("generic follow-up wording does not accidentally request the whole portfolio", () => {
  const followup = "Hãy giải thích thêm về nội dung vừa trả lời.";
  assert.deepEqual(portfolioCategoriesForPrompt(followup), []);
  assert.equal(
    portfolioPromptForFollowup(followup, [
      { role: "user", text: "Phân tích crypto của tôi" },
      { role: "pixel", text: "Tóm tắt danh mục crypto." },
    ]),
    "Phân tích crypto của tôi",
  );
});

test("follow-up without a prior portfolio question stays unscoped", () => {
  const followup = "Hãy giải thích thêm về nội dung vừa trả lời.";
  assert.equal(portfolioPromptForFollowup(followup, []), followup);
});

test("calendar dates require a real YYYY-MM-DD calendar day", () => {
  assert.equal(isValidYmd("2024-02-29"), true);
  assert.equal(isValidYmd("2026-02-29"), false);
  assert.equal(isValidYmd("2026-13-01"), false);
  assert.equal(isValidYmd("2026-2-01"), false);
});
