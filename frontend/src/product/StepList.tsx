import { Badge, Paper, Text } from "@mantine/core"
import type { StepStatus } from "./sim"

export interface StepItem { label: string; status: StepStatus; detail: string }

const STATUS: Record<StepStatus, { color: string; text: string }> = {
  ok: { color: "green", text: "✓ пройдено" },
  fail: { color: "red", text: "✗ провалено" },
  skip: { color: "gray", text: "— не перевіряється" },
  trust: { color: "yellow", text: "✓ на слово сервера" },
}

export default function StepList({ steps }: { steps: StepItem[] }) {
  return (
    <Paper withBorder radius="md">
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1.5rem minmax(0, 1fr) auto",
            columnGap: 12,
            rowGap: 2,
            alignItems: "start",
            padding: "8px 16px",
            borderTop: i ? "1px solid #e9ecef" : undefined,
          }}
        >
          <Text fz="xs" c="dimmed" ff="monospace" pt={2}>{i + 1}</Text>
          <Text fz="sm">{s.label}</Text>
          <Badge color={STATUS[s.status].color} variant="light" sx={{ flexShrink: 0 }}>{STATUS[s.status].text}</Badge>
          <Text fz="xs" c="dimmed" ff="monospace" sx={{ gridColumn: "2 / 4", wordBreak: "break-word" }}>{s.detail}</Text>
        </div>
      ))}
    </Paper>
  )
}
