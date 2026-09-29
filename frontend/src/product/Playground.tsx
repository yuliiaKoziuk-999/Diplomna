import { useEffect, useMemo, useRef, useState } from "react"
import { Alert, Button, Chip, Grid, Group, Paper, SimpleGrid, Slider, Stack, Text } from "@mantine/core"
import StepList from "./StepList"
import {
  Attack, Bundle, Method, Pt, dist, forEachBall, revealedIds, serve, stats, toReceipt, verify,
} from "./sim"

const CLUSTER_COLORS = ["#3f76a3", "#6e9440", "#a5673f", "#6b58a6", "#2f8a82", "#a64f7c"]
const ACCENT = "#d9480f", INK = "#17212b", MUTED = "#8a95a0", BAD = "#c92a2a", CHAIN = "#3c4e8a"

const METHOD_OPTIONS: { value: Method; label: string; hint: string }[] = [
  { value: "V0", label: "Лише включення", hint: "типова реалізація" },
  { value: "A", label: "A · повне розкриття", hint: "базова лінія" },
  { value: "B", label: "B · кільце", hint: "основний" },
  { value: "C", label: "C · ball-tree", hint: "експеримент" },
]
const ATTACK_OPTIONS: { value: Attack; label: string }[] = [
  { value: "none", label: "Чесний" },
  { value: "hide", label: "Приховати найкращий" },
  { value: "centroid", label: "Підмінити кластери" },
  { value: "tamper", label: "Підробити вектор" },
  { value: "rollback", label: "Rollback на v1" },
]
const ATTACK_TEXT: Record<Exclude<Attack, "none">, string> = {
  hide: "приховав найкращий документ",
  centroid: "шукав не в тих кластерах",
  tamper: "підробив вектор результату",
  rollback: "відповів зі старого індексу v1",
}

function draw(canvas: HTMLCanvasElement, b: Bundle, q: Pt) {
  const ctx = canvas.getContext("2d")!
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 600
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, w)
  const P = (v: number) => w * v
  const idx = b.idx!, probed = new Set(b.probed)
  const rk = b.results.length ? Math.max(...b.results.map((r) => dist(q, r))) : 0

  if (b.variant === "B") {
    for (const id of b.probed) {
      const c = idx.clusters[id].c, d = dist(q, c)
      ctx.save()
      ctx.beginPath(); ctx.arc(P(c.x), P(c.y), P(d + rk), 0, Math.PI * 2); ctx.arc(P(c.x), P(c.y), P(Math.max(0, d - rk)), 0, Math.PI * 2, true)
      ctx.globalAlpha = 0.1; ctx.fillStyle = ACCENT; ctx.fill("evenodd")
      ctx.globalAlpha = 0.8; ctx.setLineDash([4, 4]); ctx.strokeStyle = ACCENT; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(P(c.x), P(c.y), P(d + rk), 0, Math.PI * 2); ctx.stroke()
      if (d - rk > 0) { ctx.beginPath(); ctx.arc(P(c.x), P(c.y), P(d - rk), 0, Math.PI * 2); ctx.stroke() }
      ctx.restore()
    }
  }
  if (b.variant === "C") {
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = CHAIN; ctx.lineWidth = 1
    b.balls!.forEach((bl) => forEachBall(bl.tree, (p) => {
      if (p.t !== "cut") return
      ctx.beginPath(); ctx.arc(P(p.c.x), P(p.c.y), P(p.rad), 0, Math.PI * 2)
      ctx.globalAlpha = 0.07; ctx.fillStyle = CHAIN; ctx.fill(); ctx.globalAlpha = 0.75; ctx.stroke()
    }))
    ctx.strokeStyle = ACCENT; ctx.globalAlpha = 0.6; ctx.setLineDash([2, 4])
    ctx.beginPath(); ctx.arc(P(q.x), P(q.y), P(rk), 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  }
  const { ids: rev } = revealedIds(b)
  idx.clusters.forEach((cl) => cl.members.forEach((m) => {
    ctx.beginPath(); ctx.arc(P(m.x), P(m.y), probed.has(cl.id) ? 3.6 : 2.8, 0, Math.PI * 2)
    ctx.fillStyle = CLUSTER_COLORS[cl.id]; ctx.globalAlpha = probed.has(cl.id) ? 0.95 : 0.35; ctx.fill(); ctx.globalAlpha = 1
    if (rev.has(m.id) && (b.variant === "B" || b.variant === "C")) { ctx.strokeStyle = ACCENT; ctx.lineWidth = 1; ctx.stroke() }
  }))
  idx.clusters.forEach((cl) => {
    const x = P(cl.c.x), y = P(cl.c.y), s = 6
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath()
    ctx.fillStyle = CLUSTER_COLORS[cl.id]; ctx.fill()
    ctx.strokeStyle = probed.has(cl.id) ? INK : MUTED; ctx.lineWidth = probed.has(cl.id) ? 1.6 : 0.8; ctx.stroke()
    ctx.fillStyle = INK; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillText(String(cl.id), x + 8, y - 6)
  })
  ctx.lineWidth = 1.8; ctx.strokeStyle = ACCENT
  b.results.forEach((r, i) => {
    ctx.beginPath(); ctx.arc(P(r.x), P(r.y), 7.5, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = ACCENT; ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.fillText(String(i + 1), P(r.x) + 8, P(r.y) + 12)
  })
  if (b.hidden) {
    const x = P(b.hidden.x), y = P(b.hidden.y)
    ctx.strokeStyle = BAD; ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke()
  }
  const qx = P(q.x), qy = P(q.y)
  ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(qx, qy, 5.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = INK; ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.fillText("q", qx + 10, qy - 9)
}

interface Props {
  onParams: (k: number, nprobe: number) => void
  onSendReceipt: (json: string) => void
}

export default function Playground({ onParams, onSendReceipt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [q, setQ] = useState<Pt>({ x: 0.44, y: 0.47 })
  const [k, setK] = useState(4)
  const [nprobe, setNprobe] = useState(2)
  const [method, setMethod] = useState<Method>("B")
  const [attack, setAttack] = useState<Attack>("none")

  const bundle = useMemo(() => serve(q, k, nprobe, method, attack), [q, k, nprobe, method, attack])
  const result = useMemo(() => verify(bundle, q, k), [bundle, q, k])
  const st = useMemo(() => stats(bundle), [bundle])

  useEffect(() => {
    const redraw = () => canvasRef.current && draw(canvasRef.current, bundle, q)
    redraw()
    window.addEventListener("resize", redraw)
    return () => window.removeEventListener("resize", redraw)
  }, [bundle, q])

  useEffect(() => onParams(k, nprobe), [k, nprobe, onParams])

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setQ({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height })
  }

  const attacked = attack !== "none"
  const firstFail = result.steps.find((s) => s.status === "fail")
  const verdict = result.accepted && attacked
    ? { color: "yellow", title: "Прийнято. Атаку не виявлено", text: `Сервер ${ATTACK_TEXT[attack as Exclude<Attack, "none">]}, а клієнт прийняв відповідь як коректну.` }
    : result.accepted
      ? { color: "green", title: "Прийнято", text: "Сервер чесний, усі перевірки пройдено." }
      : { color: "red", title: "Відхилено", text: `${attacked ? `Сервер ${ATTACK_TEXT[attack as Exclude<Attack, "none">]}. ` : ""}${firstFail?.detail}.` }

  const { ids: revIds, bounds } = revealedIds(bundle)
  const resIds = new Set(bundle.results.map((r) => r.id))

  return (
    <Grid gutter="lg">
      <Grid.Col md={6}>
        <Paper withBorder p="sm" radius="md">
          <canvas ref={canvasRef} className="ap-canvas" onClick={onCanvasClick} aria-label="Поле векторів: натисніть, щоб задати запит" />
          <Group spacing="xs" mt="sm">
            <Button size="xs" variant="default" onClick={() => setQ({ x: 0.08 + Math.random() * 0.84, y: 0.08 + Math.random() * 0.84 })}>
              Випадковий запит
            </Button>
            <Button size="xs" variant="light" onClick={() => onSendReceipt(JSON.stringify(toReceipt(bundle, q, k), null, 2))}>
              Відкрити квитанцію в перевірці
            </Button>
          </Group>
          <Text fz="xs" c="dimmed" mt="xs">
            Помаранчеві кола — результати, штрихове кільце — діапазон методу B, синя штрихова куля — відсічене піддерево C, червоний хрестик — документ, який приховав сервер.
          </Text>
        </Paper>
      </Grid.Col>
      <Grid.Col md={6}>
        <Stack spacing="sm">
          <Text fz="xs" tt="uppercase" c="dimmed" fw={600}>Метод перевірки</Text>
          <Chip.Group value={method} onChange={(v) => setMethod(v as Method)}>
            <Group spacing={6}>
              {METHOD_OPTIONS.map((m) => <Chip key={m.value} value={m.value}>{m.label}</Chip>)}
            </Group>
          </Chip.Group>
          <Text fz="xs" tt="uppercase" c="dimmed" fw={600}>Поведінка сервера</Text>
          <Chip.Group value={attack} onChange={(v) => setAttack(v as Attack)}>
            <Group spacing={6}>
              {ATTACK_OPTIONS.map((a) => <Chip key={a.value} value={a.value} color={a.value === "none" ? "green" : "red"}>{a.label}</Chip>)}
            </Group>
          </Chip.Group>
          <SimpleGrid cols={2}>
            <Stack spacing={4}>
              <Text fz="xs" c="dimmed">k = {k}</Text>
              <Slider min={1} max={8} value={k} onChange={setK} label={null} />
            </Stack>
            <Stack spacing={4}>
              <Text fz="xs" c="dimmed">nprobe = {nprobe}</Text>
              <Slider min={1} max={4} value={nprobe} onChange={setNprobe} label={null} />
            </Stack>
          </SimpleGrid>
          <Alert color={verdict.color} title={verdict.title}>{verdict.text}</Alert>
          <StepList steps={result.steps} />
          <SimpleGrid cols={4} breakpoints={[{ maxWidth: "xs", cols: 2 }]} spacing="xs">
            {[
              [st.vec, "векторів розкрито"],
              [st.hashes, "хешів у доказі"],
              [`${st.kb.toFixed(1)} КБ`, "доказ при d = 384"],
              [st.dists, "відстаней рахує клієнт"],
            ].map(([v, l]) => (
              <Paper key={l} withBorder p="xs" radius="md">
                <Text ff="monospace" fw={500}>{v}</Text>
                <Text fz="xs" c="dimmed">{l}</Text>
              </Paper>
            ))}
          </SimpleGrid>
          {bundle.probed.map((id) => {
            const cl = bundle.idx!.clusters[id]
            return (
              <Stack key={id} spacing={4}>
                <Text fz="xs" c="dimmed" ff="monospace">кластер {id} · {cl.size} листків за зростанням ‖v−c‖</Text>
                <div className="ap-cells">
                  {cl.members.map((m) => {
                    const cls = bundle.hidden?.id === m.id ? "hid" : resIds.has(m.id) ? "res" : revIds.has(m.id) ? (bounds.has(m.id) ? "bnd" : "rev") : ""
                    return <span key={m.id} className={`ap-cell ${cls}`} title={`${m.id} · r=${m.r.toFixed(3)}`} />
                  })}
                </div>
              </Stack>
            )
          })}
        </Stack>
      </Grid.Col>
    </Grid>
  )
}
