# Кабінет, підписки та оплата: запуск у тестовому режимі

Оплата йде через **Stripe у тестовому режимі**: справжні гроші не списуються.
Stripe обрано для тестового середовища, бо тестові ключі видаються одразу
після реєстрації, а сторінка оплати, кабінет керування карткою і тестові
картки вже готові. Для реальних платежів з українського ФОП/ТОВ Stripe
недоступний, тому провайдер винесено за інтерфейс `PaymentProvider`
(`backend/src/billing/payment-provider.ts`): LiqPay додається як ще один
клас, логіка підписок не змінюється.

## 1. База даних

```bash
cd backend
docker compose up -d        # Postgres :5433, Redis :6381
npm run migrate             # таблиці Subscription, ApiKey, AnchorRecord, ProcessedWebhookEvent
```

## 2. Ключі Stripe

1. Зареєструйтесь на https://dashboard.stripe.com і залиштесь у режимі **Test mode**.
2. Скопіюйте Secret key (`sk_test_...`) у файл `backend/.env.local`
   (він у `.gitignore`; `.env` комітиться, туди ключі не кладіть):

   ```
   STRIPE_SECRET_KEY=sk_test_...
   FRONTEND_URL=http://localhost:5173
   ```

3. Створіть тарифи і налаштування кабінету Stripe однією командою:

   ```bash
   npm run stripe:setup
   ```

   Скрипт створить продукти Pro / Business / Verifiable Search з
   місячними цінами й допише їхні id у `.env.local`. Працює лише з `sk_test_`.

## 3. Вебхуки (рекомендовано)

Без вебхуків кабінет теж працює: після оплати він сам звіряє сесію, а при
кожному відкритті підтягує стан підписки зі Stripe. Щоб події (скасування,
невдала оплата) приходили одразу, встановіть Stripe CLI і запустіть:

```bash
stripe login
npm run stripe:listen
```

CLI надрукує `whsec_...`: допишіть його в `.env.local` як `STRIPE_WEBHOOK_SECRET`.

## 4. Запуск

```bash
cd backend && npm run start:dev
cd frontend && npm run dev
```

- http://localhost:5173/pricing — тарифи
- http://localhost:5173/account — кабінет: тариф, використання, документи, API-ключі, рахунки

## Тестові картки

| Картка | Що станеться |
|---|---|
| `4242 4242 4242 4242` | успішна оплата |
| `4000 0027 6000 3184` | запит 3-D Secure |
| `4000 0000 0000 0002` | картку відхилено |

Будь-яка майбутня дата, будь-який CVC.

## Що перевірити руками

1. Зареєструватись, відкрити `/pricing`, оформити Pro карткою `4242…` → у кабінеті тариф Pro, ліміт 50 000.
2. «Змінити тариф» → Business: підписка змінюється без повторної оплати, різниця йде в наступний рахунок.
3. «Скасувати» → бейдж «Діє до …», кнопка «Відновити підписку».
4. «Картка і рахунки» відкриває кабінет Stripe; рахунки видно у вкладці «Оплата».
5. Вкладка «Документи»: перетягнути файл → «Закрити зараз (тест)» → «Перевірити» показує два ✓.
6. Вкладка «API-ключі»: створити ключ і надіслати хеш прикладом `curl` зі сторінки.
7. На Free надіслати понад 100 документів за місяць → API відповідає 403 з повідомленням про ліміт.

## API

| Метод | Шлях | Авторизація |
|---|---|---|
| GET | `/billing/plans` | — |
| GET | `/billing/subscription?refresh=1` | cookie |
| POST | `/billing/checkout` `{plan}` | cookie |
| POST | `/billing/checkout/confirm` `{sessionId}` | cookie |
| POST | `/billing/cancel`, `/billing/resume`, `/billing/portal` | cookie |
| GET | `/billing/invoices` | cookie |
| POST | `/billing/webhook` | підпис Stripe |
| GET/POST | `/account/anchors` | cookie |
| POST | `/account/anchors/close-epoch` | cookie, лише не в production |
| GET/POST/DELETE | `/account/api-keys` | cookie |
| POST | `/v1/anchor` `{sha256, label?}` | `Authorization: Bearer ap_test_…` |
| GET | `/v1/anchor/:id` | `Authorization: Bearer ap_test_…` |

## Обмеження, про які варто знати

- Анкорування поки mock (`AnchoringService` у пам'яті): після перезапуску
  бекенда перевірка кореня в ланцюжку для старих квитанцій покаже «недоступний».
  Доказ Меркла при цьому лишається валідним. Виправляється деплоєм
  `MerkleAnchor.sol` у Polygon Amoy.
- Ліміти рахуються за календарний місяць (UTC), а не за період оплати.
