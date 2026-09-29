import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Alert, Loader, Stack, Tabs, Text, Title } from "@mantine/core"
import { IconAlertCircle, IconCircleCheck, IconCreditCard, IconFiles, IconGauge, IconKey } from "@tabler/icons-react"
import AccountShell, { useRequireLogin } from "../layouts/AccountShell"
import OverviewTab from "../components/account/OverviewTab"
import DocumentsTab from "../components/account/DocumentsTab"
import ApiKeysTab from "../components/account/ApiKeysTab"
import BillingTab from "../components/account/BillingTab"
import { BillingOverview, billingApi } from "../api/account"

const TABS = ["overview", "documents", "api-keys", "billing"] as const
type Tab = (typeof TABS)[number]

export default function Account() {
  const userId = useRequireLogin(true)
  const [params, setParams] = useSearchParams()
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const confirmed = useRef(false)

  const tabParam = params.get("tab") as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "overview"

  const refresh = useCallback(() => {
    billingApi.overview(true).then(setOverview).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!userId) return
    const sessionId = params.get("session_id")
    if (params.get("checkout") === "success" && sessionId && !confirmed.current) {
      // The webhook may not have arrived yet (or no listener runs locally): sync from the session.
      confirmed.current = true
      billingApi
        .confirm(sessionId)
        .then((o) => {
          setOverview(o)
          setNotice(`Оплату прийнято. Тариф ${o.planName} активний.`)
        })
        .catch((e) => setError(e.message))
        .finally(() => setParams({}, { replace: true }))
      return
    }
    if (params.get("changed") === "1") {
      setNotice("Тариф змінено. Різницю в ціні буде враховано в наступному рахунку.")
      setParams({}, { replace: true })
    }
    refresh()
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectTab = (value: string) => setParams(value === "overview" ? {} : { tab: value }, { replace: true })

  return (
    <AccountShell>
      {!userId ? (
        <Stack align="flex-start">
          <Title order={2}>Кабінет</Title>
          <Text c="dimmed">Увійдіть або зареєструйтесь, щоб керувати тарифом і документами.</Text>
        </Stack>
      ) : (
        <Stack spacing="lg">
          <Title order={1}>Кабінет</Title>
          {notice && (
            <Alert color="green" icon={<IconCircleCheck size="1rem" />} withCloseButton onClose={() => setNotice(null)}>
              {notice}
            </Alert>
          )}
          {error && (
            <Alert color="red" icon={<IconAlertCircle size="1rem" />} withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {!overview ? (
            <Loader />
          ) : (
            <Tabs value={tab} onTabChange={(v) => v && selectTab(v)} keepMounted={false}>
              <Tabs.List mb="lg">
                <Tabs.Tab value="overview" icon={<IconGauge size="1rem" />}>Огляд</Tabs.Tab>
                <Tabs.Tab value="documents" icon={<IconFiles size="1rem" />}>Документи</Tabs.Tab>
                <Tabs.Tab value="api-keys" icon={<IconKey size="1rem" />}>API-ключі</Tabs.Tab>
                <Tabs.Tab value="billing" icon={<IconCreditCard size="1rem" />}>Оплата</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="overview"><OverviewTab overview={overview} onChange={setOverview} /></Tabs.Panel>
              <Tabs.Panel value="documents"><DocumentsTab onUsageChange={refresh} /></Tabs.Panel>
              <Tabs.Panel value="api-keys"><ApiKeysTab /></Tabs.Panel>
              <Tabs.Panel value="billing"><BillingTab overview={overview} /></Tabs.Panel>
            </Tabs>
          )}
        </Stack>
      )}
    </AccountShell>
  )
}
