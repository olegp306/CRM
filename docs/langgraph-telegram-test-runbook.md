# LangGraph Telegram Test Runbook

Date: 2026-06-05

Use this runbook only on a test workspace, test database, and test Telegram bot. Keep production on the legacy runtime until the four checks below pass in the test stand.

## Enable LangGraph

1. Open the test CRM web app.
2. Go to `Settings` -> `Telegram runtime`.
3. Select `LangGraph`.
4. Choose the model for the test run.
5. Save the setting.
6. Confirm the page shows `Current runtime: langgraph`.

## Optional Synthetic Worker Smoke

After saving `Current runtime: langgraph`, you can run one local synthetic worker pass before polling the real test bot. This uses the same worker entrypoint, reads the workspace Telegram runtime setting, and injects a single test update instead of calling `getUpdates`.

PowerShell example for the test VM:

```powershell
$env:TELEGRAM_TEST_CHAT_ID="12345"
$env:TELEGRAM_TEST_MESSAGE_ID="9001"
$env:TELEGRAM_TEST_RECEIVED_AT="2026-06-05T10:00:00.000Z"
$env:TELEGRAM_TEST_MESSAGE="Следующий потенциальный клиент: Ирина Шнайдер, нужен КП на архитектуру для Neubau EFH. Адрес Gartenweg 9, Bad Aibling. BGF 195 м2. Email irina.schneider@example.com, телефон +49 160 4442211."
pnpm worker:telegram
```

Expected result:

- The worker processes one synthetic update.
- A lead is created in the test database.
- Telegram polling is not used for this run.
- The setting still controls the route: switch back to `Legacy` to compare behavior.

## Required Telegram Checks

### 1. Create Lead

Send a new message to the test bot:

```text
Следующий потенциальный клиент: Ирина Шнайдер, нужен КП на архитектуру для Neubau EFH. Адрес Gartenweg 9, Bad Aibling. BGF 195 м2. Email irina.schneider@example.com, телефон +49 160 4442211.
```

Expected result:

- A new lead is created.
- The Telegram response contains the lead id.
- The response includes a CRM button for that lead.

### 2. Update Lead By Reply

Reply to the created lead card:

```text
Обнови бюджет: 32000 EUR. Канал связи WhatsApp.
```

Expected result:

- The same lead is updated.
- No new lead is created.
- The update is visible in lead history and in the CRM card.

### 3. Create Reminder By Reply

Reply to the same lead card:

```text
Напомни завтра позвонить клиенту и уточнить недостающие данные для КП.
```

Expected result:

- A reminder/follow-up is created for that lead.
- The reminder appears in the lead calendar/action list.
- Telegram responds with a CRM button for the lead.

### 4. Add Client Context Note By Reply

Reply to the same lead card:

```text
Запомни об этом клиенте: любит футбол и каждый год ходит на Oktoberfest.
```

Expected result:

- The note is added to the lead context/history.
- No field is overwritten unless the message clearly asks for a field update.
- Telegram responds with a CRM button for the lead.

## Pass Criteria

The LangGraph runtime is ready for broader test use only when:

- All four checks pass against the test database.
- Production still shows `legacy` in `Settings` -> `Telegram runtime`.
- No production Telegram bot token or production database URL is used by the test process.

## Rollback

If any check fails:

1. Switch `Settings` -> `Telegram runtime` back to `Legacy`.
2. Save.
3. Retry the same Telegram message and confirm the legacy runtime still works.
4. Keep the PR in draft until the failing LangGraph route is fixed.
