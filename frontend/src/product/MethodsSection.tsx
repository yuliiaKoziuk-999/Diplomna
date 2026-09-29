import { useEffect, useState } from "react"
import { Badge, Grid, Paper, ScrollArea, Stack, Table, Text, Title } from "@mantine/core"
import { ATTACKS, METHODS, Method, bench } from "./sim"

const METHOD_ROWS = [
  { name: "Лише включення", idea: "Доказ Меркла для кожного з k результатів.", plus: "Найменший доказ", minus: "Не бачить приховування, підміни кластерів і rollback", badge: ["red", "недостатньо"] },
  { name: "A. Повне розкриття", idea: "Сервер віддає всі вектори перевірених кластерів, клієнт перераховує все сам.", plus: "Просто і прозоро", minus: "Доказ росте з розміром кластера", badge: ["gray", "базова лінія"] },
  { name: "B. Кільцевий діапазон", idea: "Кластер відсортовано за відстанню до центроїда; за нерівністю трикутника кандидати лежать у суцільному кільці, розкривається лише воно плюс дві межі.", plus: "Менший доказ, O(log n) хешів", minus: "У високих вимірах кільце ширшає", badge: ["orange", "у продукті"], rec: true },
  { name: "C. Merkle ball-tree", idea: "Кожен вузол комітить кулю; клієнт відсікає піддерева, гарантовано далі за r_k.", plus: "Мало листків для великих кластерів", minus: "Кожна відсічена куля розкриває свій центр", badge: ["yellow", "експеримент"] },
  { name: "D. zk-доказ пошуку", idea: "SNARK доводить правильність усього обчислення top-k.", plus: "≈ 0,3 КБ після Groth16-обгортки (оцінка)", minus: "Генерація — хвилини на запит (оцінка)", badge: ["gray", "дослідження"] },
]
const LABEL: Record<Method, string> = { V0: "Включення", A: "A", B: "B", C: "C" }
const ATTACK_NAME: Record<string, string> = { hide: "Приховати найкращий", centroid: "Підмінити кластери", tamper: "Підробити вектор", rollback: "Rollback" }
const BAR_COLOR: Record<Method, string> = { V0: "#adb5bd", A: "#d9480f", B: "#d9480f", C: "#3c4e8a" }

export default function MethodsSection({ k, nprobe }: { k: number; nprobe: number }) {
  const [data, setData] = useState<ReturnType<typeof bench> | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setData(bench(k, nprobe)), 150)
    return () => clearTimeout(t)
  }, [k, nprobe])

  const max = data ? Math.max(...METHODS.map((m) => data.avgKb[m])) : 1

  return (
    <Stack spacing="lg">
      <Paper withBorder radius="md">
        <ScrollArea>
          <Table verticalSpacing="sm" miw={760}>
            <thead><tr><th>Метод</th><th>Ідея</th><th>Сильна сторона</th><th>Обмеження</th><th>Статус</th></tr></thead>
            <tbody>
              {METHOD_ROWS.map((r) => (
                <tr key={r.name} style={r.rec ? { background: "#fff4e6" } : undefined}>
                  <td><Text fz="sm" fw={600}>{r.name}</Text></td>
                  <td><Text fz="sm">{r.idea}</Text></td>
                  <td><Text fz="sm">{r.plus}</Text></td>
                  <td><Text fz="sm">{r.minus}</Text></td>
                  <td><Badge color={r.badge[0]}>{r.badge[1]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Grid gutter="lg">
        <Grid.Col md={6}>
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="sm">Середній розмір доказу, КБ</Title>
            {!data ? <Text c="dimmed">Рахуємо…</Text> : (
              <Stack spacing={8}>
                {METHODS.map((m) => {
                  const pct = (data.avgKb[m] / max) * 100, inside = pct > 55
                  return (
                    <Grid key={m} gutter="xs" align="center">
                      <Grid.Col span={3}><Text fz="sm">{m === "V0" ? "Лише включення" : `${m}`}</Text></Grid.Col>
                      <Grid.Col span={9}>
                        <div className="ap-bar-track">
                          <div className="ap-bar-fill" style={{ width: `${pct}%`, background: BAR_COLOR[m] }} />
                          <span className="ap-bar-val" style={inside ? { right: `${100 - pct}%`, paddingRight: 8, color: "#fff" } : { left: `${pct}%`, paddingLeft: 8 }}>
                            {data.avgKb[m].toFixed(1)} КБ
                          </span>
                        </div>
                      </Grid.Col>
                    </Grid>
                  )
                })}
                <Text fz="xs" c="dimmed">
                  k = {k}, nprobe = {nprobe}: метод B на {Math.round((1 - data.avgKb.B / data.avgKb.A) * 100)} % менший за A.
                  D — близько 0,3 КБ, але хвилини на генерацію (оцінка, не вимір).
                </Text>
              </Stack>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col md={6}>
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="sm">Частка виявлених атак</Title>
            {!data ? <Text c="dimmed">Рахуємо…</Text> : (
              <Table verticalSpacing={6}>
                <thead><tr><th>Атака</th>{METHODS.map((m) => <th key={m}>{LABEL[m]}</th>)}</tr></thead>
                <tbody>
                  {ATTACKS.map((a) => (
                    <tr key={a}>
                      <td><Text fz="sm">{ATTACK_NAME[a]}</Text></td>
                      {METHODS.map((m) => {
                        const x = data.detection[m][a]
                        return <td key={m}>{x === null ? <Badge color="gray">н/д</Badge> : <Badge color={x === 1 ? "green" : x === 0 ? "red" : "yellow"}>{Math.round(x * 100)} %</Badge>}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Text fz="xs" c="dimmed" mt="xs">80 випадкових запитів з параметрами демо. У 2D методи B і C виглядають вигідніше, ніж будуть при 384 вимірах.</Text>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
