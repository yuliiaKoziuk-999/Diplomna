import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  List,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core"
import { IconAlertCircle, IconCheck, IconCreditCard } from "@tabler/icons-react"
import AccountShell from "../layouts/AccountShell"
import { useUserStore } from "../stores/userStore"
import { useGeneralStore } from "../stores/generalStore"
import { BillingOverview, Plan, PlanId, billingApi } from "../api/account"
import { SALES_EMAIL } from "../config"

export default function Pricing() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const userId = useUserStore((s) => s.id)
  const toggleLogin = useGeneralStore((s) => s.toggleLoginModal)
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    billingApi.plans().then(setPlans).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!userId) return setOverview(null)
    billingApi.overview().then(setOverview).catch(() => setOverview(null))
  }, [userId])

  const choose = async (plan: PlanId) => {
    if (!userId) return toggleLogin()
    setBusy(plan)
    setError(null)
    try {
      const res = await billingApi.checkout(plan)
      if (res.url) {
        window.location.assign(res.url)
        return
      }
      navigate("/account?changed=1")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const current = overview?.plan

  return (
    <AccountShell>
      <Stack spacing="xl">
        <Stack spacing={6}>
          <Title order={1}>Тарифи</Title>
          <Text c="dimmed" maw={640}>
            Платите за записи, а не за блокчейн: газ уже в ціні, а батчинг ділить одну транзакцію в Polygon між
            тисячами документів. Змінити або скасувати тариф можна в кабінеті будь-коли.
          </Text>
        </Stack>

        {params.get("checkout") === "cancel" && (
          <Alert color="gray" icon={<IconAlertCircle size="1rem" />}>
            Оплату скасовано, кошти не списано. Можете обрати тариф ще раз.
          </Alert>
        )}
        {error && (
          <Alert color="red" icon={<IconAlertCircle size="1rem" />} withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!plans ? (
          <Loader />
        ) : (
          <SimpleGrid cols={4} spacing="md" breakpoints={[{ maxWidth: "md", cols: 2 }, { maxWidth: "xs", cols: 1 }]}>
            {plans.map((plan) => {
              const isCurrent = current === plan.id || (!current && plan.id === "free" && !!userId)
              const highlight = plan.id === "search"
              return (
                <Card
                  key={plan.id}
                  withBorder
                  padding="lg"
                  sx={(t) => ({
                    display: "flex",
                    flexDirection: "column",
                    gap: t.spacing.sm,
                    borderColor: highlight ? t.colors.orange[6] : undefined,
                  })}
                >
                  <Group position="apart">
                    <Text fw={600}>{plan.name}</Text>
                    {isCurrent && <Badge color="green">Ваш тариф</Badge>}
                  </Group>
                  <Text fz={28} fw={600}>
                    {plan.priceUsd === 0 ? "$0" : `$${plan.priceUsd}`}
                    <Text span fz="sm" c="dimmed" fw={400}> / міс</Text>
                  </Text>
                  <Text fz="sm" c="dimmed">
                    {plan.anchorsPerMonth === null
                      ? "Без ліміту анкорів"
                      : `${plan.anchorsPerMonth.toLocaleString("uk-UA")} анкорів на місяць`}
                  </Text>
                  <List spacing={4} size="sm" icon={<IconCheck size="0.9rem" />} sx={{ flex: 1 }}>
                    {plan.features.map((f) => <List.Item key={f}>{f}</List.Item>)}
                  </List>
                  {plan.id === "free" ? (
                    <Button variant="default" disabled={isCurrent} onClick={() => (userId ? navigate("/account") : toggleLogin())}>
                      {isCurrent ? "Поточний" : userId ? "Перейти через кабінет" : "Почати безкоштовно"}
                    </Button>
                  ) : (
                    <Button
                      variant={highlight ? "filled" : "light"}
                      loading={busy === plan.id}
                      disabled={isCurrent && !overview?.cancelAtPeriodEnd}
                      leftIcon={<IconCreditCard size="1rem" />}
                      onClick={() => choose(plan.id)}
                    >
                      {isCurrent ? "Поточний" : current && current !== "free" ? "Перейти на цей тариф" : "Оформити"}
                    </Button>
                  )}
                </Card>
              )
            })}
          </SimpleGrid>
        )}

        <Card withBorder padding="lg">
          <Group position="apart" align="flex-start">
            <Stack spacing={4} maw={560}>
              <Text fw={600}>Enterprise</Text>
              <Text fz="sm" c="dimmed">
                Розгортання у вашій інфраструктурі, власний ключ індексатора з multisig, супровід впровадження.
              </Text>
            </Stack>
            {SALES_EMAIL && (
              <Button variant="default" component="a" href={`mailto:${SALES_EMAIL}?subject=AnchorProof%20Enterprise`}>
                Обговорити
              </Button>
            )}
          </Group>
        </Card>

        <Alert color="blue" title="Тестовий режим оплати">
          <Text fz="sm">
            Оплата працює через Stripe у тестовому режимі, справжні гроші не списуються. Картка{" "}
            <Code>4242 4242 4242 4242</Code>, будь-яка майбутня дата і будь-який CVC. Картка з 3-D Secure:{" "}
            <Code>4000 0027 6000 3184</Code>. Відхилена картка: <Code>4000 0000 0000 0002</Code>.
          </Text>
        </Alert>
      </Stack>
    </AccountShell>
  )
}
