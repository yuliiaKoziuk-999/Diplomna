import { api, post } from "./http"

export type PlanId = "free" | "pro" | "business" | "search"

export interface Plan {
  id: PlanId
  name: string
  priceUsd: number
  anchorsPerMonth: number | null
  features: string[]
}

export interface BillingOverview {
  plan: PlanId
  planName: string
  status: "active" | "trialing" | "past_due" | "incomplete" | "canceled" | "unpaid"
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  hasPaymentAccount: boolean
  billingEnabled: boolean
  usage: { anchorsThisMonth: number; anchorsLimit: number | null; periodStart: string }
}

export interface Invoice {
  id: string
  number: string | null
  createdAt: string
  amount: number
  currency: string
  status: string
  hostedUrl: string | null
  pdfUrl: string | null
}

export interface DocumentReceipt {
  type: "document-receipt"
  v: number
  sha256: string
  leaf: string
  leafRule: string
  epoch: number
  batchRoot: string
  leafIndex: number
  siblings: string[]
  txHash: string
  network: string
}

export interface AnchorItem {
  id: string
  sha256: string
  label: string | null
  status: "pending" | "anchored"
  createdAt: string
  anchoredAt?: string
  receipt?: DocumentReceipt
}

export interface ApiKeyItem {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  secret?: string
}

export const billingApi = {
  plans: () => api<Plan[]>("/billing/plans"),
  overview: (refresh = false) => api<BillingOverview>(`/billing/subscription${refresh ? "?refresh=1" : ""}`),
  checkout: (plan: PlanId) => post<{ url?: string; overview?: BillingOverview }>("/billing/checkout", { plan }),
  confirm: (sessionId: string) => post<BillingOverview>("/billing/checkout/confirm", { sessionId }),
  cancel: () => post<BillingOverview>("/billing/cancel"),
  resume: () => post<BillingOverview>("/billing/resume"),
  portal: () => post<{ url: string }>("/billing/portal"),
  invoices: () => api<Invoice[]>("/billing/invoices"),
}

export const accountApi = {
  anchors: () => api<AnchorItem[]>("/account/anchors"),
  anchor: (sha256: string, label: string) => post<AnchorItem>("/account/anchors", { sha256, label }),
  closeEpoch: () => post<{ anchored: number; epoch?: number }>("/account/anchors/close-epoch"),
  keys: () => api<ApiKeyItem[]>("/account/api-keys"),
  createKey: (name: string) => post<ApiKeyItem>("/account/api-keys", { name }),
  revokeKey: (id: number) => api<ApiKeyItem>(`/account/api-keys/${id}`, { method: "DELETE" }),
  chainRoot: (version: number) =>
    api<{ version: number; root: string; timestamp: number; txHash: string }>(`/v1/roots/${version}`),
}

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" }) : "—"

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" }) : "—"
