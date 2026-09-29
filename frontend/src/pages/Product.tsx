import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Accordion, Badge, Box, Button, Card, Code, Group, List, Paper, SimpleGrid, Stack, Text, Title,
} from "@mantine/core"
import { IconCheck } from "@tabler/icons-react"
import AccountShell from "../layouts/AccountShell"
import DocumentsTab from "../components/account/DocumentsTab"
import Playground from "../product/Playground"
import VerifySection from "../product/VerifySection"
import Calculator from "../product/Calculator"
import MethodsSection from "../product/MethodsSection"
import { dist, serve, short, stats, verify } from "../product/sim"
import { Plan, billingApi } from "../api/account"
import { useUserStore } from "../stores/userStore"
import { useGeneralStore } from "../stores/generalStore"
import "../product/product.css"

const SECTIONS = [
  ["products", "Продукти"], ["cases", "Для кого"], ["playground", "Демо"], ["anchor", "Анкорування"],
  ["verify", "Перевірка"], ["methods", "Методи"], ["pricing", "Тарифи"], ["faq", "FAQ"],
] as const

const USE_CASES = [
  ["Санкційний і AML-скринінг", "Перевірка контрагента за списками", "пошук ішов по актуальній версії списку, і жоден близький збіг не відфільтровано."],
  ["Legaltech", "RAG по судовій практиці", "жодне релевантніше рішення не випало з вибірки, і це можна показати клієнту чи суду."],
  ["Медицина і фарма", "Клінічні настанови", "відповідь спиралась на поточну редакцію настанов, а не на застарілу."],
  ["Закупівлі та HR", "Відбір пропозицій і кандидатів", "нікого не прибрали з видачі вручну, тож спірне рішення можна перевірити."],
  ["Аудит AI-систем", "Журнал для відповідності", "журнал запитів і джерел не редагували після події."],
  ["Автори, юристи, розробники", "Доказ існування документа", "файл існував саме в цьому вигляді на дату епохи."],
]

const FAQ = [
  ["Чи потрапляють мої дані в блокчейн?", "Ні. У Polygon записується лише 32-байтовий корінь дерева Меркла і номер версії. Документи й вектори залишаються у вашому сховищі, а для фіксації файлу на сервер іде лише його SHA-256."],
  ["Це гарантує, що знайдено точних k найближчих?", "Гарантія діє відносно параметра nprobe: серед перевірених кластерів нічого не пропущено, а самі кластери обрано чесно. Для точного пошуку можна поставити nprobe рівним кількості кластерів."],
  ["Кому тут треба довіряти?", "Власник даних будує індекс і підписує анкор своїм ключем. Серверу, що відповідає на запити, довіряти не потрібно. Для Enterprise ключ індексатора можна зробити multisig."],
  ["Наскільки це сповільнює пошук?", "Сервер додатково збирає доказ, клієнт перераховує кілька десятків відстаней і хешів, це мілісекунди. Основна ціна — розмір доказу, тому використовується кільцевий метод."],
  ["Що буде, якщо AnchorProof зникне?", "Квитанції продовжать перевірятися: верифікатор відкритий, а корені лежать у публічному контракті."],
]

function HeroReceipt() {
  const r = useMemo(() => {
    const q = { x: 0.44, y: 0.47 }
    const b = serve(q, 4, 2, "B", "none")
    return { q, b, ok: verify(b, q, 4).accepted, kb: stats(b).kb }
  }, [])
  const row = (a: string, c: string) => <div className="row" key={a}><span>{a}</span><span>{c}</span></div>
  return (
    <div className="ap-receipt" aria-label="Приклад квитанції пошуку">
      <div className="rh">КВИТАНЦІЯ ПОШУКУ</div>
      {row("запит", "q = (0.44, 0.47)")}
      {row("k / nprobe", "4 / 2 з 6")}
      <hr />
      {r.b.results.map((x, i) => row(`${i + 1}. ${x.id}`, `d = ${dist(r.q, x).toFixed(3)}`))}
      <hr />
      {row("метод", "кільцевий діапазон")}
      {row("доказ", `${r.kb.toFixed(1)} КБ`)}
      {row("globalRoot", short(r.b.root))}
      {row("версія індексу", `v${r.b.version} · latest`)}
      {row("мережа", "Polygon (демо)")}
      <div className="stamp">{r.ok ? "ПОВНОТУ ПІДТВЕРДЖЕНО" : "ВІДХИЛЕНО"}</div>
    </div>
  )
}

function Section({ id, eyebrow, title, lede, children }: { id: string; eyebrow: string; title: string; lede?: string; children: React.ReactNode }) {
  return (
    <Box component="section" id={id} pt={56} sx={{ scrollMarginTop: 72 }}>
      <Stack spacing={6} mb="lg">
        <Text fz="xs" tt="uppercase" c="dimmed" fw={600} ff="monospace" sx={{ letterSpacing: "0.08em" }}>{eyebrow}</Text>
        <Title order={2}>{title}</Title>
        {lede && <Text c="dimmed" maw={720}>{lede}</Text>}
      </Stack>
      {children}
    </Box>
  )
}

export default function Product() {
  const navigate = useNavigate()
  const userId = useUserStore((s) => s.id)
  const toggleLogin = useGeneralStore((s) => s.toggleLoginModal)
  const [params, setParams] = useState({ k: 4, nprobe: 2 })
  const [receiptText, setReceiptText] = useState("")
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const verifyRef = useRef<HTMLDivElement>(null)

  useEffect(() => { billingApi.plans().then(setPlans).catch(() => setPlans([])) }, [])

  const onParams = useCallback((k: number, nprobe: number) => setParams({ k, nprobe }), [])
  const sendToVerifier = useCallback((json: string) => {
    setReceiptText(json)
    document.getElementById("verify")?.scrollIntoView({ behavior: "smooth" })
  }, [])

  return (
    <AccountShell>
      <Group spacing={4} mb="md" sx={{ overflowX: "auto", flexWrap: "nowrap" }}>
        {SECTIONS.map(([id, label]) => (
          <Button key={id} component="a" href={`#${id}`} variant="subtle" color="gray" size="xs">{label}</Button>
        ))}
      </Group>

      <SimpleGrid cols={2} spacing={48} breakpoints={[{ maxWidth: "md", cols: 1 }]} sx={{ alignItems: "center" }} py="lg">
        <Stack spacing="lg">
          <Text fz="xs" tt="uppercase" c="dimmed" fw={600} ff="monospace">Перевірюваний пошук для AI-систем</Text>
          <Title order={1} sx={{ fontSize: "clamp(2rem, 4.4vw, 3rem)", lineHeight: 1.15 }}>Докажіть, що ваш AI нічого не приховав</Title>
          <Text fz="lg" c="dimmed">
            AnchorProof додає до кожної відповіді RAG-системи криптографічну квитанцію: з яких документів зібрано відповідь,
            що жоден релевантніший документ не пропущено і що індекс не підмінили заднім числом. Корінь індексу фіксується
            в мережі Polygon, тому квитанцію може перевірити будь-хто.
          </Text>
          <Group spacing="sm">
            <Button component="a" href="#playground">Спробувати демо</Button>
            <Button variant="default" component="a" href="#anchor">Зафіксувати документ</Button>
            <Button variant="default" onClick={() => navigate("/pricing")}>Тарифи</Button>
          </Group>
        </Stack>
        <Group position="center"><HeroReceipt /></Group>
      </SimpleGrid>

      <Section id="products" eyebrow="Продукти" title="Два сервіси на одному рушії"
        lede="Почніть з фіксації хешів, а коли будуватимете AI-пошук, додайте квитанції повноти. Перевірка квитанцій відкрита для всіх.">
        <SimpleGrid cols={3} breakpoints={[{ maxWidth: "md", cols: 1 }]}>
          {[
            ["Anchor API · доступно зараз", "Фіксація документів у Polygon", "SHA-256 файлу, логу чи датасету батчується в дерево Меркла, у блокчейн іде один корінь на епоху.", "цей документ існував у такому вигляді не пізніше цієї епохи.", "#1c7ed6"],
            ["Verifiable Search · для RAG", "Квитанції повноти пошуку", "Проксі перед pgvector, Qdrant чи Pinecone: автентифікований IVF-індекс і кільцевий доказ повноти до кожної відповіді.", "результати справжні, кластери обрано чесно, нічого не приховано, індекс актуальний.", "#d9480f"],
            ["Відкритий верифікатор · MIT", "Перевірка без довіри до нас", "Бібліотека verification-sdk і сторінка перевірки: клієнт, аудитор чи регулятор перевіряє квитанцію сам.", "гарантія не залежить від репутації постачальника.", "#868e96"],
          ].map(([tag, title, text, proves, color]) => (
            <Card key={title} withBorder padding="lg" sx={{ borderTop: `3px solid ${color}` }}>
              <Stack spacing="xs">
                <Text fz="xs" tt="uppercase" c="dimmed" fw={600}>{tag}</Text>
                <Title order={4}>{title}</Title>
                <Text fz="sm" c="dimmed">{text}</Text>
                <Text fz="sm"><Text span fz="xs" tt="uppercase" c="orange" fw={600}>Квитанція доводить: </Text>{proves}</Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Section>

      <Section id="cases" eyebrow="Для кого" title="Там, де пропущений документ коштує дорого">
        <SimpleGrid cols={3} breakpoints={[{ maxWidth: "md", cols: 2 }, { maxWidth: "xs", cols: 1 }]}>
          {USE_CASES.map(([tag, title, proves]) => (
            <Card key={title} withBorder padding="lg">
              <Stack spacing={6}>
                <Text fz="xs" tt="uppercase" c="dimmed" fw={600}>{tag}</Text>
                <Title order={5}>{title}</Title>
                <Text fz="sm"><Text span fz="xs" tt="uppercase" c="orange" fw={600}>Квитанція доводить: </Text>{proves}</Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Section>

      <Section id="playground" eyebrow="Демо · Verifiable Search" title="Спробуйте обманути клієнта"
        lede="Наочна 2D-симуляція у браузері: 150 документів, 6 IVF-кластерів, справжні дерева Меркла і справжня перевірка. Метод B працює і на справжньому бекенді: сторінка «Демо пошуку» в меню.">
        <Playground onParams={onParams} onSendReceipt={sendToVerifier} />
      </Section>

      <Section id="anchor" eyebrow="Anchor API" title="Зафіксуйте документ"
        lede="Файл не покидає браузер: на сервер іде лише SHA-256. Хеш потрапляє в батч, після закриття епохи ви отримуєте квитанцію з доказом Меркла.">
        {userId ? (
          <Stack spacing="lg">
            <DocumentsTab onUsageChange={() => undefined} />
            <Calculator />
          </Stack>
        ) : (
          <Stack spacing="lg">
            <Paper withBorder p="lg" radius="md">
              <Group position="apart">
                <Stack spacing={4}>
                  <Text fw={600}>Увійдіть, щоб фіксувати документи</Text>
                  <Text fz="sm" c="dimmed">Тариф Free дає 100 анкорів на місяць без картки.</Text>
                </Stack>
                <Button onClick={toggleLogin}>Увійти або зареєструватись</Button>
              </Group>
            </Paper>
            <Calculator />
          </Stack>
        )}
      </Section>

      <Section id="verify" eyebrow="Відкритий верифікатор" title="Перевірте квитанцію"
        lede="Підтримуються квитанції документів з кабінету, відповіді реального пошуку /verifiable-search і квитанції з демо.">
        <div ref={verifyRef}><VerifySection text={receiptText} onText={setReceiptText} /></div>
      </Section>

      <Section id="methods" eyebrow="Під капотом" title="Чотири методи довести повноту"
        lede="Усі методи гарантують повноту відносно nprobe. Цифри рахуються на тих самих даних, що й демо, з його поточними k і nprobe.">
        <MethodsSection k={params.k} nprobe={params.nprobe} />
      </Section>

      <Section id="pricing" eyebrow="Тарифи" title="Платите за записи, а не за блокчейн"
        lede="Газ уже в ціні: батчинг ділить одну транзакцію між тисячами записів.">
        <SimpleGrid cols={4} breakpoints={[{ maxWidth: "md", cols: 2 }, { maxWidth: "xs", cols: 1 }]}>
          {(plans ?? []).map((p) => (
            <Card key={p.id} withBorder padding="lg" sx={(t) => ({ display: "flex", flexDirection: "column", gap: t.spacing.xs, borderColor: p.id === "search" ? t.colors.orange[6] : undefined })}>
              <Group position="apart"><Text fw={600}>{p.name}</Text>{p.id === "search" && <Badge>для RAG</Badge>}</Group>
              <Text fz={26} fw={600}>${p.priceUsd}<Text span fz="sm" c="dimmed" fw={400}> / міс</Text></Text>
              <List spacing={3} size="sm" icon={<IconCheck size="0.9rem" />} sx={{ flex: 1 }}>
                {p.features.map((f) => <List.Item key={f}>{f}</List.Item>)}
              </List>
              <Button variant={p.id === "search" ? "filled" : "light"} onClick={() => navigate("/pricing")}>
                {p.priceUsd === 0 ? "Почати" : "Оформити"}
              </Button>
            </Card>
          ))}
        </SimpleGrid>
        {plans?.length === 0 && <Text c="dimmed">Тарифи недоступні: бекенд не відповідає.</Text>}
        <Paper withBorder p="lg" radius="md" mt="lg">
          <Text fw={600} mb="xs">Інтеграція через API</Text>
          <Code block>{`curl -X POST http://localhost:3000/v1/anchor \\
  -H "Authorization: Bearer ap_test_…" \\
  -H "Content-Type: application/json" \\
  -d '{"sha256":"<64 hex>","label":"contract.pdf"}'`}</Code>
          <Text fz="xs" c="dimmed" mt="xs">Ключ створюється в кабінеті, вкладка «API-ключі».</Text>
        </Paper>
      </Section>

      <Section id="faq" eyebrow="Питання" title="Часті питання">
        <Accordion variant="separated">
          {FAQ.map(([q, a]) => (
            <Accordion.Item key={q} value={q}>
              <Accordion.Control>{q}</Accordion.Control>
              <Accordion.Panel><Text c="dimmed">{a}</Text></Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Section>

      <Text fz="xs" c="dimmed" mt={48} pt="md" sx={(t) => ({ borderTop: `1px solid ${t.colors.gray[3]}` })}>
        AnchorProof — прототип, що виріс із магістерської роботи. Демо пошуку є симуляцією у браузері; анкорування поки працює
        на mock-реєстрі бекенда, смарт-контракт ще не розгорнуто в Polygon. Ціни орієнтовні.
      </Text>
    </AccountShell>
  )
}
