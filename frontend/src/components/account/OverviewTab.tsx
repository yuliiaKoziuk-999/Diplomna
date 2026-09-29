import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Alert, Badge, Button, Card, Group, Progress, SimpleGrid, Stack, Text, Title } from "@mantine/core"
import { IconAlertCircle, IconExternalLink } from "@tabler/icons-react"
import { BillingOverview, billingApi, formatDate } from "../../api/account"

const STATUS: Record<BillingOverview["status"], { label: string; color: string }> = {
  active: { label: "Активна", color: "green" },
  trialing: { label: "Пробний період", color: "blue" },
  past_due: { label: "Оплата не пройшла", color: "red" },
  unpaid: { label: "Не оплачено", color: "red" },
  incomplete: { label: "Очікує оплати", color: "yellow" },
  canceled: { label: "Скасовано", color: "gray" },
}

interface Props {
  overview: BillingOverview
  onChange: (o: BillingOverview) => void
}

export default function OverviewTab({ overview: o, onChange }: Props) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name)
    setError(null)
    try {
      await fn()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const openPortal = () => run("portal", async () => window.location.assign((await billingApi.portal()).url))
  const cancel = () => run("cancel", async () => { onChange(await billingApi.cancel()); setConfirmCancel(false) })
  const resume = () => run("resume", async () => onChange(await billingApi.resume()))

  const paid = o.plan !== "free"
  const limit = o.usage.anchorsLimit
  const used = o.usage.anchorsThisMonth
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0
  const status = o.cancelAtPeriodEnd ? { label: `Діє до ${formatDate(o.currentPeriodEnd)}`, color: "orange" } : STATUS[o.status]

  return (
    <Stack spacing="md">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size="1rem" />} withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {!o.billingEnabled && (
        <Alert color="yellow" title="Оплату ще не налаштовано">
          Додайте STRIPE_SECRET_KEY у backend/.env.local і запустіть npm run stripe:setup. Безкоштовний тариф працює і без цього.
        </Alert>
      )}
      {o.status === "past_due" && (
        <Alert color="red" title="Не вдалося списати оплату">
          Оновіть картку в розділі керування оплатою, інакше тариф повернеться до Free.
        </Alert>
      )}

      <SimpleGrid cols={2} breakpoints={[{ maxWidth: "sm", cols: 1 }]}>
        <Card withBorder padding="lg">
          <Stack spacing="xs">
            <Text fz="xs" tt="uppercase" c="dimmed" fw={600}>Тариф</Text>
            <Group spacing="sm">
              <Title order={2}>{o.planName}</Title>
              <Badge color={status.color}>{status.label}</Badge>
            </Group>
            <Text fz="sm" c="dimmed">
              {!paid
                ? "Безкоштовний тариф без картки."
                : o.cancelAtPeriodEnd
                  ? `Підписку скасовано. Після ${formatDate(o.currentPeriodEnd)} тариф зміниться на Free, списань більше не буде.`
                  : `Наступне списання ${formatDate(o.currentPeriodEnd)}.`}
            </Text>
            <Group spacing="xs" mt="xs">
              <Button onClick={() => navigate("/pricing")}>{paid ? "Змінити тариф" : "Оформити тариф"}</Button>
              {o.hasPaymentAccount && (
                <Button variant="default" loading={busy === "portal"} rightIcon={<IconExternalLink size="0.9rem" />} onClick={openPortal}>
                  Картка і рахунки
                </Button>
              )}
              {paid && o.cancelAtPeriodEnd && (
                <Button variant="light" color="green" loading={busy === "resume"} onClick={resume}>Відновити підписку</Button>
              )}
              {paid && !o.cancelAtPeriodEnd && !confirmCancel && (
                <Button variant="subtle" color="red" onClick={() => setConfirmCancel(true)}>Скасувати</Button>
              )}
            </Group>
            {confirmCancel && (
              <Alert color="red" mt="xs">
                <Text fz="sm" mb="xs">
                  Тариф діятиме до {formatDate(o.currentPeriodEnd)}, потім зміниться на Free. Скасувати підписку?
                </Text>
                <Group spacing="xs">
                  <Button color="red" size="xs" loading={busy === "cancel"} onClick={cancel}>Так, скасувати</Button>
                  <Button variant="default" size="xs" onClick={() => setConfirmCancel(false)}>Залишити</Button>
                </Group>
              </Alert>
            )}
          </Stack>
        </Card>

        <Card withBorder padding="lg">
          <Stack spacing="xs">
            <Text fz="xs" tt="uppercase" c="dimmed" fw={600}>Використання з {formatDate(o.usage.periodStart)}</Text>
            <Group spacing={6} align="baseline">
              <Title order={2}>{used.toLocaleString("uk-UA")}</Title>
              <Text c="dimmed">{limit === null ? "анкорів, без ліміту" : `з ${limit.toLocaleString("uk-UA")} анкорів`}</Text>
            </Group>
            {limit !== null && <Progress value={pct} color={pct >= 90 ? "red" : pct >= 70 ? "yellow" : "orange"} size="lg" />}
            <Text fz="sm" c="dimmed">
              {limit === null
                ? "Лічильник скидається першого числа кожного місяця."
                : used >= limit
                  ? "Ліміт вичерпано: нові документи не приймаються до наступного місяця або до зміни тарифу."
                  : `Залишилось ${(limit - used).toLocaleString("uk-UA")}. Лічильник скидається першого числа.`}
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
