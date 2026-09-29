import { useState } from "react"
import { Alert, Button, CopyButton, Grid, Group, Stack, Text, Textarea } from "@mantine/core"
import { BackendMockChainReader, ProofBundle, hashLeaf, verifyInclusionProof, verifySearchResult } from "verification-sdk"
import StepList, { StepItem } from "./StepList"
import { verifyReceipt, SearchReceipt } from "./sim"
import { API_BASE, post } from "../api/http"
import { accountApi, DocumentReceipt } from "../api/account"

interface Outcome { ok: boolean; title: string; steps: StepItem[] }

/** Document receipts from the Anchor API: Merkle proof here, root read back from the anchor registry. */
async function checkDocument(r: DocumentReceipt): Promise<Outcome> {
  const steps: StepItem[] = []
  const leafOk = hashLeaf(r.sha256).toLowerCase() === String(r.leaf).toLowerCase()
  steps.push({ label: "Лист квитанції відповідає SHA-256 документа", status: leafOk ? "ok" : "fail", detail: r.leafRule })
  const proofOk = leafOk && verifyInclusionProof(r.leaf, r.siblings, r.batchRoot)
  steps.push({ label: "Документ входить у батч епохи", status: proofOk ? "ok" : "fail", detail: `епоха ${r.epoch}, ${r.siblings.length} хешів доказу` })
  try {
    const anchor = await accountApi.chainRoot(r.epoch)
    const same = anchor.root.toLowerCase() === r.batchRoot.toLowerCase()
    steps.push({ label: "Корінь збігається з анкором", status: same ? "ok" : "fail", detail: `версія ${r.epoch}, tx ${anchor.txHash.slice(0, 12)}…` })
  } catch {
    steps.push({
      label: "Корінь збігається з анкором",
      status: "fail",
      detail: "анкор недоступний: поки контракт не задеплоєний, mock-реєстр очищається при перезапуску бекенда",
    })
  }
  const ok = steps.every((s) => s.status === "ok")
  return { ok, title: ok ? `Документ підтверджено: існував не пізніше епохи ${r.epoch}` : "Квитанцію відхилено", steps }
}

/** Real search responses from backend/src/verifiable-search (ivf-ring-v2), checked by the SDK. */
async function checkRealSearch(bundle: ProofBundle): Promise<Outcome> {
  const verdict = await verifySearchResult(bundle, new BackendMockChainReader(API_BASE))
  return {
    ok: verdict.valid,
    title: verdict.valid ? "Відповідь сервера підтверджено: повноту доведено кільцевим доказом" : "Відповідь відхилено",
    steps: verdict.steps.map((s) => ({ label: s.label, status: s.ok ? "ok" : "fail", detail: s.detail })),
  }
}

function checkSimulated(o: SearchReceipt): Outcome {
  const v = verifyReceipt(o)
  return {
    ok: v.accepted,
    title: v.accepted ? `Повноту підтверджено (симуляція, метод ${o.method})` : "Квитанцію відхилено",
    steps: v.steps,
  }
}

export default function VerifySection({ text, onText }: { text: string; onText: (t: string) => void }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (raw = text) => {
    setError(null)
    setOutcome(null)
    let o: any
    try {
      o = JSON.parse(raw)
    } catch {
      setError("Це не схоже на JSON. Перевірте дужки й лапки.")
      return
    }
    setBusy(true)
    try {
      if (o?.type === "document-receipt") setOutcome(await checkDocument(o))
      else if (o?.type === "simulated-search-receipt") setOutcome(checkSimulated(o))
      else if (o?.proofBundle?.protocol || o?.protocol) setOutcome(await checkRealSearch(o.proofBundle ?? o))
      else setError("Невідомий формат. Підтримуються квитанції документів, відповіді /verifiable-search/search і квитанції з демо.")
    } catch (e: any) {
      setError(`Квитанція пошкоджена: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const loadRealSearch = async () => {
    setError(null)
    try {
      const res = await post<unknown>("/verifiable-search/search", { query: "блокчейн анкорування", k: 3, nprobe: 2 })
      const json = JSON.stringify(res, null, 2)
      onText(json)
      run(json)
    } catch (e: any) {
      setError(`Бекенд пошуку недоступний: ${e.message}`)
    }
  }

  return (
    <Grid gutter="lg">
      <Grid.Col md={6}>
        <Stack spacing="sm">
          <Textarea
            value={text}
            onChange={(e) => onText(e.currentTarget.value)}
            minRows={14}
            maxRows={14}
            autosize
            styles={{ input: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 } }}
            placeholder="Вставте JSON квитанції"
            aria-label="JSON квитанції"
          />
          <Group spacing="xs">
            <Button onClick={() => run()} loading={busy}>Перевірити</Button>
            <Button variant="default" onClick={loadRealSearch}>Приклад: реальний пошук</Button>
            <CopyButton value={text}>
              {({ copied, copy }) => <Button variant="subtle" onClick={copy}>{copied ? "Скопійовано" : "Копіювати"}</Button>}
            </CopyButton>
          </Group>
        </Stack>
      </Grid.Col>
      <Grid.Col md={6}>
        <Stack spacing="sm">
          {error && <Alert color="red">{error}</Alert>}
          {outcome && <Alert color={outcome.ok ? "green" : "red"} title={outcome.title}>Змініть будь-яку цифру в JSON і перевірте ще раз.</Alert>}
          {outcome && <StepList steps={outcome.steps} />}
          {!error && !outcome && (
            <Text c="dimmed" fz="sm">
              Перевірка виконується у вашому браузері бібліотекою verification-sdk. Квитанцію документа можна взяти в кабінеті, квитанцію пошуку — з демо вище.
            </Text>
          )}
        </Stack>
      </Grid.Col>
    </Grid>
  )
}
