import { useCallback, useEffect, useState } from "react"
import { Alert, Badge, Button, Card, Code, Group, Loader, ScrollArea, Stack, Table, Text } from "@mantine/core"
import { Dropzone } from "@mantine/dropzone"
import { IconAlertCircle, IconDownload, IconFileUpload, IconShieldCheck } from "@tabler/icons-react"
import { hashLeaf, verifyInclusionProof } from "verification-sdk"
import { AnchorItem, accountApi, formatDateTime } from "../../api/account"

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

type Check = { ok: boolean; text: string }

/** Independent check in the browser: Merkle proof here, root read back from the anchor registry. */
async function verifyReceipt(item: AnchorItem): Promise<Check[]> {
  const r = item.receipt!
  const leafOk = hashLeaf(r.sha256).toLowerCase() === r.leaf.toLowerCase()
  const proofOk = leafOk && verifyInclusionProof(r.leaf, r.siblings, r.batchRoot)
  const checks: Check[] = [
    { ok: proofOk, text: proofOk ? `Документ входить у батч епохи ${r.epoch} (${r.siblings.length} хешів доказу)` : "Доказ Меркла не сходиться до кореня батчу" },
  ]
  try {
    const anchor = await accountApi.chainRoot(r.epoch)
    const same = anchor.root.toLowerCase() === r.batchRoot.toLowerCase()
    checks.push({ ok: same, text: same ? `Корінь збігається з анкором версії ${r.epoch}` : "Корінь у реєстрі інший, квитанцію підроблено" })
  } catch {
    checks.push({
      ok: false,
      text: "Анкор цієї епохи недоступний. Поки контракт не задеплоєний, mock-реєстр очищається при перезапуску бекенда.",
    })
  }
  return checks
}

function download(item: AnchorItem) {
  const blob = new Blob([JSON.stringify(item.receipt, null, 2)], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `receipt-${item.id}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function DocumentsTab({ onUsageChange }: { onUsageChange: () => void }) {
  const [items, setItems] = useState<AnchorItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [checks, setChecks] = useState<Record<string, Check[]>>({})

  const load = useCallback(() => {
    accountApi.anchors().then(setItems).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  const onDrop = async (files: File[]) => {
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        await accountApi.anchor(await sha256Hex(file), file.name)
      }
      load()
      onUsageChange()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const closeEpoch = async () => {
    setClosing(true)
    try {
      await accountApi.closeEpoch()
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setClosing(false)
    }
  }

  const pending = items?.filter((i) => i.status === "pending").length ?? 0

  return (
    <Stack spacing="md">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size="1rem" />} withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Dropzone onDrop={onDrop} loading={uploading} multiple maxSize={200 * 1024 * 1024}>
        <Group position="center" spacing="md" mih={110} sx={{ pointerEvents: "none" }}>
          <IconFileUpload size="2.2rem" stroke={1.4} />
          <Stack spacing={2}>
            <Text fw={500}>Перетягніть файли або натисніть, щоб обрати</Text>
            <Text fz="sm" c="dimmed">Файл не покидає браузер: на сервер іде лише його SHA-256.</Text>
          </Stack>
        </Group>
      </Dropzone>

      {pending > 0 && (
        <Alert color="orange" icon={<Loader size="xs" />}>
          <Group position="apart">
            <Text fz="sm">{pending} документ(и) чекають закриття епохи. Епоха закривається автоматично щохвилини.</Text>
            <Button size="xs" variant="light" loading={closing} onClick={closeEpoch}>Закрити зараз (тест)</Button>
          </Group>
        </Alert>
      )}

      <Card withBorder padding={0}>
        {!items ? (
          <Group p="lg"><Loader size="sm" /></Group>
        ) : items.length === 0 ? (
          <Text p="lg" c="dimmed">Ще немає документів. Додайте перший файл вище або надішліть хеш через API.</Text>
        ) : (
          <ScrollArea>
            <Table verticalSpacing="sm" highlightOnHover miw={760}>
              <thead>
                <tr><th>Документ</th><th>SHA-256</th><th>Статус</th><th>Додано</th><th /></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Text fz="sm" fw={500}>{item.label || "без назви"}</Text>
                      <Text fz="xs" c="dimmed" ff="monospace">{item.id}</Text>
                      {checks[item.id]?.map((c, i) => (
                        <Text key={i} fz="xs" c={c.ok ? "green" : "red"}>{c.ok ? "✓" : "✗"} {c.text}</Text>
                      ))}
                    </td>
                    <td><Code>{item.sha256.slice(0, 16)}…</Code></td>
                    <td>
                      {item.status === "anchored"
                        ? <Badge color="green">Епоха {item.receipt?.epoch}</Badge>
                        : <Badge color="orange">В батчі</Badge>}
                    </td>
                    <td><Text fz="sm">{formatDateTime(item.createdAt)}</Text></td>
                    <td>
                      {item.receipt && (
                        <Group spacing={4} noWrap>
                          <Button size="xs" variant="light" leftIcon={<IconShieldCheck size="0.9rem" />}
                            onClick={async () => {
                              const result = await verifyReceipt(item)
                              setChecks((c) => ({ ...c, [item.id]: result }))
                            }}>
                            Перевірити
                          </Button>
                          <Button size="xs" variant="default" leftIcon={<IconDownload size="0.9rem" />} onClick={() => download(item)}>
                            Квитанція
                          </Button>
                        </Group>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>
    </Stack>
  )
}
