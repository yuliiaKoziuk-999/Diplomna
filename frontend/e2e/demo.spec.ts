import { expect, test, Page } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"

const API = "http://localhost:3000"
const OUT = "e2e/demo-output"
const shots: { file: string; title: string; note: string }[] = []

const isWatch = () => !!test.info().project.metadata?.watch

/** In watch mode: a banner naming the current step, and a pause to read it. */
async function banner(page: Page, text: string) {
  if (!isWatch()) return
  await page.evaluate((t) => {
    let el = document.getElementById("e2e-banner")
    if (!el) {
      el = document.createElement("div")
      el.id = "e2e-banner"
      el.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;background:#17212b;color:#fff;" +
        "font:600 18px system-ui,sans-serif;padding:12px 22px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35);" +
        "max-width:80vw;text-align:center;pointer-events:none"
      document.body.appendChild(el)
    }
    el.textContent = t
  }, text)
  await page.waitForTimeout(1500)
}

async function shot(page: Page, title: string, note = "") {
  const file = `${String(shots.length + 1).padStart(2, "0")}.png`
  await banner(page, note ? `${title} — ${note}` : title)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${file}` })
  shots.push({ file, title, note })
}

const alertWith = (page: Page, text: string | RegExp) => page.getByRole("alert").filter({ hasText: text }).first()

test("AnchorProof: повний прохід по продукту", async ({ page }) => {
  mkdirSync(OUT, { recursive: true })
  // Fresh throwaway account for this run on the local dev database.
  const user = {
    fullname: "Demo User",
    email: `demo-${Date.now()}@anchorproof.test`,
    password: randomBytes(9).toString("base64url"),
  }

  await test.step("Сторінка продукту", async () => {
    await page.goto("/product")
    await expect(page.getByRole("heading", { name: "Докажіть, що ваш AI нічого не приховав" })).toBeVisible()
    await shot(page, "Головний екран", "Квитанція пошуку праворуч рахується вживу рушієм демо.")
    await page.locator("#products").scrollIntoViewIfNeeded()
    await shot(page, "Продукти", "Anchor API, Verifiable Search і відкритий верифікатор.")
    await page.locator("#cases").scrollIntoViewIfNeeded()
    await shot(page, "Для кого", "Сценарії використання з формулюванням «квитанція доводить».")
  })

  await test.step("Демо атак (симуляція)", async () => {
    await page.locator("#playground").scrollIntoViewIfNeeded()
    await page.locator("canvas.ap-canvas").click({ position: { x: 250, y: 230 } })
    await expect(alertWith(page, "Прийнято")).toBeVisible()
    await shot(page, "Демо: чесний сервер, метод B", "Усі перевірки пройдено.")

    await page.locator("#playground").getByText("Приховати найкращий", { exact: true }).click()
    await expect(alertWith(page, "Відхилено")).toBeVisible()
    await shot(page, "Демо: сервер приховав найкращий документ", "Метод B відхиляє відповідь: корінь діапазону не збігся.")

    await page.locator("#playground").getByText("Лише включення", { exact: true }).click()
    await expect(alertWith(page, "Атаку не виявлено")).toBeVisible()
    await shot(page, "Та сама атака проти старого верифікатора", "Лише докази включення атаку пропускають.")

    await page.locator("#playground").getByText("C · ball-tree", { exact: true }).click()
    await page.locator("#playground").getByText("Rollback на v1", { exact: true }).click()
    await expect(alertWith(page, "Відхилено")).toBeVisible()
    await shot(page, "Метод C проти rollback", "Відхилено: версія індексу застаріла.")

    await page.locator("#playground").getByText("B · кільце", { exact: true }).click()
    await page.locator("#playground").getByText("Чесний", { exact: true }).click()
    await page.getByRole("button", { name: "Відкрити квитанцію в перевірці" }).click()
    await page.getByRole("button", { name: "Перевірити", exact: true }).click()
    await expect(alertWith(page, "Повноту підтверджено")).toBeVisible()
    await shot(page, "Перевірка квитанції з демо", "Квитанцію передано у верифікатор і підтверджено.")
  })

  await test.step("Верифікатор: реальний пошук", async () => {
    await page.getByRole("button", { name: "Приклад: реальний пошук" }).click()
    await expect(alertWith(page, "повноту доведено кільцевим доказом")).toBeVisible()
    await shot(page, "Відповідь справжнього бекенда", "verification-sdk перевірив реальну відповідь ivf-ring-v2 покроково.")
  })

  await test.step("Методи і калькулятор", async () => {
    await page.locator("#methods").scrollIntoViewIfNeeded()
    await expect(page.getByText("Частка виявлених атак")).toBeVisible()
    await page.getByText("Частка виявлених атак").scrollIntoViewIfNeeded()
    await shot(page, "Порівняння методів", "Розмір доказу і частка виявлених атак на 80 запитах.")
    await page.locator("#anchor").scrollIntoViewIfNeeded()
    await page.getByText("E2 · епохи", { exact: true }).scrollIntoViewIfNeeded()
    await shot(page, "Калькулятор анкорування", "Вартість і свіжість для режимів E1, E2, E3.")
  })

  await test.step("Реєстрація", async () => {
    await page.goto("/account")
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await dialog.getByLabel("Fullname").fill(user.fullname)
    await dialog.getByLabel("Email").fill(user.email)
    await dialog.getByLabel("Password", { exact: true }).fill(user.password)
    await dialog.getByLabel("Confirm Password").fill(user.password)
    await shot(page, "Реєстрація", "Тестовий акаунт у локальній базі.")
    await dialog.getByRole("button", { name: "Register", exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole("heading", { name: "Кабінет" })).toBeVisible()
  })

  await test.step("Кабінет: огляд", async () => {
    await expect(page.getByText("Free").first()).toBeVisible()
    await shot(page, "Кабінет: огляд", "Тариф Free, лічильник використання, попередження, що Stripe не налаштовано.")
  })

  await test.step("Кабінет: документи", async () => {
    await page.getByRole("tab", { name: "Документи" }).click()
    await page.locator("input[type=file]").setInputFiles([
      { name: "договір-17.pdf", mimeType: "application/pdf", buffer: Buffer.from("Договір №17, редакція 3") },
      { name: "dataset-v2.csv", mimeType: "text/csv", buffer: Buffer.from("id,text\n1,hello\n") },
    ])
    await expect(page.getByText("В батчі").first()).toBeVisible()
    await shot(page, "Документи в батчі", "Файли не покидають браузер, на сервер іде лише SHA-256.")
    await page.getByRole("button", { name: "Закрити зараз (тест)" }).click()
    await expect(page.getByText(/^Епоха \d+/).first()).toBeVisible()
    await page.getByRole("button", { name: "Перевірити" }).first().click()
    await expect(page.getByText(/Корінь збігається з анкором версії/).first()).toBeVisible()
    await shot(page, "Документи заанкорено і перевірено", "Доказ Меркла і корінь епохи перевірено в браузері.")
  })

  let secret = ""
  await test.step("Кабінет: API-ключі", async () => {
    await page.getByRole("tab", { name: "API-ключі" }).click()
    await page.getByLabel("Назва ключа").fill("Демо-сервер")
    await page.getByRole("button", { name: "Створити ключ" }).click()
    secret = await page.locator("code", { hasText: "ap_test_" }).first().innerText()
    await shot(page, "Новий API-ключ", "Ключ показується один раз, у базі лише його хеш.")

    const sha = "a".repeat(64)
    const res = await page.request.post(`${API}/v1/anchor`, {
      headers: { Authorization: `Bearer ${secret}` },
      data: { sha256: sha, label: "через API" },
    })
    expect(res.status()).toBe(201)
    const bad = await page.request.post(`${API}/v1/anchor`, {
      headers: { Authorization: "Bearer ap_test_0000" },
      data: { sha256: sha },
    })
    expect(bad.status()).toBe(401)
    await page.reload()
    await expect(page.getByText(/щойно|\d{2}:\d{2}/).first()).toBeVisible()
    await shot(page, "Ключ використано через API", "POST /v1/anchor з ключем прийнято, з вигаданим ключем — 401.")
  })

  await test.step("Кабінет: оплата і тарифи", async () => {
    await page.getByRole("tab", { name: "Оплата" }).click()
    await shot(page, "Кабінет: оплата", "Рахунки з'являться після першої оплати.")
    await page.goto("/pricing")
    await page.getByRole("button", { name: "Оформити" }).first().click()
    await expect(alertWith(page, "Оплату ще не налаштовано")).toBeVisible()
    await shot(page, "Тарифи", "Без ключа Stripe оформлення чесно повідомляє, чого бракує.")
  })

  await test.step("Демо пошуку на справжньому бекенді", async () => {
    await page.goto("/verifiable-search")
    await page.getByRole("button", { name: "Виконати запит і перевірити" }).click()
    await expect(alertWith(page, "Відповідь підтверджено")).toBeVisible()
    await shot(page, "Справжній бекенд: чесна відповідь", "Вектор запиту браузер рахує сам.")
    for (const [label, title] of [
      ["Приховати найкращий", "Справжній бекенд: приховування"],
      ["Підмінити кластери", "Справжній бекенд: підміна кластерів"],
      ["Rollback на стару версію", "Справжній бекенд: rollback"],
    ]) {
      await page.getByText(label, { exact: true }).click()
      await page.getByRole("button", { name: "Виконати запит і перевірити" }).click()
      await expect(alertWith(page, "Відповідь відхилено")).toBeVisible()
      await shot(page, title, (await alertWith(page, "Відповідь відхилено").innerText()).replace(/\s+/g, " "))
    }
  })

  writeFileSync(`${OUT}/captions.json`, JSON.stringify(shots, null, 2))
})
