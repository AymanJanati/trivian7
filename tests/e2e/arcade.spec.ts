import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
const origin = "http://localhost:3000";
test.beforeAll(async ({ request }) => {
  const health = await request.get(`${origin}/api/health`);
  expect(
    (await health.json()).mode,
    "Browser tests require local demo mode",
  ).toBe("demo");
});
async function post(api: APIRequestContext, path: string, data: unknown) {
  return api.post(`${origin}/api/${path}`, {
    data,
    headers: { Origin: origin },
  });
}
async function login(api: APIRequestContext) {
  expect(
    (await post(api, "admin/login", { password: "local-arcade-demo" })).ok(),
  ).toBeTruthy();
}
async function reset(api: APIRequestContext, gameId: string) {
  await login(api);
  expect(
    (
      await post(api, "admin/reset", {
        gameId,
        confirmation: `RESET ${gameId.toUpperCase()}`,
      })
    ).ok(),
  ).toBeTruthy();
}
async function begin(page: Page, game: string, name: string) {
  await page.getByRole("button", { name: `Play ${game}`, exact: true }).click();
  await page.getByLabel("YOUR NICKNAME").fill(name);
  await page.getByRole("button", { name: "LET’S PLAY" }).click();
}
test("responsive arcade has four games, no overflow and usable primary actions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.getByText("DEMO MODE — SCORES NOT SHARED")).toBeVisible();
    await expect(page.locator(".game-card")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (size.width >= 1366) {
      for (const button of await page.locator(".play-button").all()) {
        const rect = await button.boundingBox();
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(size.height);
      }
    }
    await page.screenshot({
      path: `test-results/home-${size.width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Play MEMORY.STACK", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("YOUR NICKNAME")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("reaction keyboard run saves, returns home, and offers same-board replay", async ({
  page,
  request,
}) => {
  await reset(request, "reaction");
  await page.goto("/");
  await begin(page, "REACTION.EXE", "BrowserNova");
  await page.locator(".reaction-field").focus();
  await page.keyboard.press("Space");
  for (let i = 0; i < 5; i++) {
    await expect(page.locator(".reaction-field")).toHaveClass(/cue/, {
      timeout: 6500,
    });
    await page.waitForTimeout(160);
    await page.keyboard.press("Space");
    await expect(page.locator(".reaction-field")).toHaveClass(/feedback/);
  }
  await expect(
    page.getByText("YOU MADE THE BOARD.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/SAVED ✓/)).toBeVisible();
  await expect(page.locator(".game-cards")).toBeVisible({ timeout: 7000 });
  await expect(
    page.locator(".board-row").filter({ hasText: "BrowserNova" }),
  ).toHaveCount(1);
  await begin(page, "REACTION.EXE", " browsernova ");
  await expect(
    page.getByRole("heading", { name: /TAG ALREADY/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "NO, CHANGE TAG" }).click();
  await expect(page.getByLabel("YOUR NICKNAME")).toBeFocused();
  await page.getByLabel("YOUR NICKNAME").fill("BROWSERNOVA");
  await page.getByRole("button", { name: "LET’S PLAY" }).click();
  await page.getByRole("button", { name: "YES, THAT’S ME" }).click();
  await expect(page.locator(".reaction-field")).toBeVisible();
  await page.getByRole("button", { name: "QUIT", exact: true }).click();
  await page.getByRole("button", { name: "QUIT WITHOUT SAVING" }).click();
  await begin(page, "MEMORY.STACK", "BrowserNova");
  await expect(page.locator(".memory-grid")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "START SEQUENCE" }),
  ).toBeVisible();
});
test("memory follows a growing sequence and accepts numeric keys", async ({
  page,
  request,
}) => {
  await reset(request, "memory");
  await page.goto("/");
  const started = page.waitForResponse((r) =>
    r.url().endsWith("/api/game/start"),
  );
  await begin(page, "MEMORY.STACK", "MemoryNova");
  const session = await (await started).json();
  await page.getByRole("button", { name: "START SEQUENCE" }).click();
  await expect(page.getByText("YOUR TURN", { exact: true })).toBeVisible({
    timeout: 6000,
  });
  for (const tile of session.sequences[0])
    await page.keyboard.press(String(tile + 1));
  await expect(page.getByText("SYNCED!", { exact: true })).toBeVisible();
  await expect(page.getByText("YOUR TURN", { exact: true })).toBeVisible({
    timeout: 6500,
  });
  await page.keyboard.press(String(((session.sequences[1][0] + 1) % 9) + 1));
  await expect(page.locator(".result-score")).toContainText("30");
});
test("aim supports twenty pointer targets and bounded mobile target positions", async ({
  page,
  request,
}) => {
  await reset(request, "aim");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await begin(page, "AIM//TRAINER", "AimNova");
  await page.getByRole("button", { name: "START TARGETS" }).click();
  const field = await page.locator(".aim-field").boundingBox();
  for (let i = 0; i < 20; i++) {
    const target = page.locator(".aim-target"),
      box = await target.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(field!.x);
    expect(box!.x + box!.width).toBeLessThanOrEqual(field!.x + field!.width);
    await target.dispatchEvent("pointerdown", {
      pointerType: "touch",
      button: 0,
    });
    await page.waitForTimeout(70);
  }
  await expect(
    page.getByText("YOU MADE THE BOARD.", { exact: true }),
  ).toBeVisible();
});
test("quiz API hides answers, keyboard choices get feedback and all fifteen questions save", async ({
  page,
  request,
}) => {
  await reset(request, "trivia");
  await page.goto("/");
  await begin(page, "GEEK.CHECK", "QuizNova");
  const questionResponse = page.waitForResponse((r) =>
    r.url().endsWith("/api/game/question"),
  );
  await page.getByRole("button", { name: "START QUIZ" }).click();
  let response = await questionResponse;
  for (let i = 0; i < 15; i++) {
    const question = await response.json();
    expect(question.correctOptionId).toBeUndefined();
    expect(question.explanation).toBeUndefined();
    expect(question.total).toBe(15);
    expect(question.difficulty).toBe(
      i < 5 ? "easy" : i < 10 ? "medium" : "hard",
    );
    const next =
      i < 14
        ? page.waitForResponse((r) => r.url().endsWith("/api/game/question"))
        : null;
    await expect(
      page.getByRole("heading", { name: question.prompt, exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(150);
    await page.keyboard.press("1");
    await expect(page.locator(".quiz-feedback")).toContainText(
      /CORRECT!|NOPE./,
    );
    if (next) response = await next;
  }
  await expect(
    page.getByText("YOU MADE THE BOARD.", { exact: true }),
  ).toBeVisible();
});
test("failed finish retains a retry across refresh and never reports saved early", async ({
  page,
  request,
}) => {
  await reset(request, "memory");
  await page.goto("/");
  const start = page.waitForResponse((r) =>
    r.url().endsWith("/api/game/start"),
  );
  await begin(page, "MEMORY.STACK", "RetryNova");
  const s = await (await start).json();
  await page.route("**/api/game/finish", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Test network failure" }),
    }),
  );
  await page.getByRole("button", { name: "START SEQUENCE" }).click();
  await expect(page.getByText("YOUR TURN", { exact: true })).toBeVisible({
    timeout: 6000,
  });
  await page.keyboard.press(String(((s.sequences[0][0] + 1) % 9) + 1));
  await expect(
    page.getByRole("button", { name: /COULD NOT SAVE/ }),
  ).toBeVisible();
  await expect(page.getByText(/SAVED ✓/)).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /COULD NOT SAVE/ }),
  ).toBeVisible();
  await page.unroute("**/api/game/finish");
  await page.getByRole("button", { name: /COULD NOT SAVE/ }).click();
  await expect(page.getByText(/SAVED ✓/)).toBeVisible();
});
test("admin authorization, CSRF origin checks and game-specific reset", async ({
  page,
  request,
}) => {
  const context = await page.request.get("/api/admin/board?gameId=reaction");
  expect(context.status()).toBe(401);
  expect(
    (
      await request.post(`${origin}/api/admin/login`, {
        data: { password: "local-arcade-demo" },
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/admin");
  await page
    .getByLabel("ADMIN PASSWORD", { exact: true })
    .fill("local-arcade-demo");
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await expect(page.getByText("DEMO MODE — SCORES NOT SHARED")).toBeVisible();
  await page.getByRole("button", { name: "GEEK.CHECK", exact: true }).click();
  await page.getByLabel("Reset confirmation phrase").fill("RESET TRIVIA");
  await page.getByRole("button", { name: "RESET THIS GAME" }).click();
  await expect(
    page.getByText("GEEK.CHECK board, attempts and sessions reset."),
  ).toBeVisible();
});
