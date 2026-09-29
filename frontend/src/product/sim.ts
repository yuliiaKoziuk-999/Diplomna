/**
 * In-browser simulation behind the product page's playground: a 2D corpus,
 * a 6-cluster IVF index with Merkle trees, an untrusted server that can
 * attack, and a client verifier for four completeness methods.
 *
 * It illustrates the thesis method (docs/thesis-plan.md, section 4) and is
 * NOT the production verifier: hashes are a fast 112-bit non-cryptographic
 * stand-in (keccak256 in the backend), and the real search service still
 * lives in backend/src/verifiable-search.
 */

export type Method = "V0" | "A" | "B" | "C"
export type Attack = "none" | "hide" | "centroid" | "tamper" | "rollback"
export type StepStatus = "ok" | "fail" | "skip" | "trust"

export interface Pt { x: number; y: number }
export interface Doc extends Pt { id: string }
interface Member extends Doc { r: number }

export const NLIST = 6
const DIM_BYTES = 384 * 4
const HASH_BYTES = 32

/* ---------- primitives ---------- */
export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function cyrb53(str: string, seed: number) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
const H = (s: string) => cyrb53(s, 1).toString(16).padStart(14, "0") + cyrb53(s, 7).toString(16).padStart(14, "0")
const EMPTY = H("EMPTY")
const r6 = (x: number) => Math.round(x * 1e6) / 1e6
const up6 = (x: number) => Math.ceil(x * 1e6) / 1e6
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
export const short = (h: string) => "0x" + String(h).slice(0, 8) + "…"
const leafOf = (m: Doc) => H("L|" + m.id + "|" + m.x.toFixed(6) + "|" + m.y.toFixed(6))
const nodeOf = (a: string, b: string) => H("N|" + a + "|" + b)
const ballHash = (l: string, r: string, c: Pt, rad: number) =>
  H("B|" + l + "|" + r + "|" + c.x.toFixed(6) + "|" + c.y.toFixed(6) + "|" + rad.toFixed(6))
interface CentroidLeaf { id: number; c: Pt; root: string; ballRoot: string; size: number }
const cLeaf = (cl: CentroidLeaf) =>
  H("C|" + cl.id + "|" + cl.c.x.toFixed(6) + "|" + cl.c.y.toFixed(6) + "|" + cl.root + "|" + cl.ballRoot + "|" + cl.size)
const heightFor = (n: number) => (n <= 1 ? 0 : Math.ceil(Math.log2(n)))

function buildLayers(leaves: string[]) {
  let size = 1
  while (size < leaves.length) size *= 2
  const l0 = leaves.slice()
  while (l0.length < size) l0.push(EMPTY)
  const layers = [l0]
  while (layers[layers.length - 1].length > 1) {
    const p = layers[layers.length - 1], n: string[] = []
    for (let i = 0; i < p.length; i += 2) n.push(nodeOf(p[i], p[i + 1]))
    layers.push(n)
  }
  return layers
}
const rootOf = (leaves: string[]) => { const L = buildLayers(leaves); return L[L.length - 1][0] }
function inclusionProof(layers: string[][], idx: number) {
  const s: string[] = []
  for (let l = 0; l < layers.length - 1; l++) { s.push(layers[l][idx ^ 1]); idx >>= 1 }
  return s
}
function verifyInclusion(leaf: string, idx: number, sib: string[], root: string) {
  let h = leaf
  for (const s of sib) { h = idx & 1 ? nodeOf(s, h) : nodeOf(h, s); idx >>= 1 }
  return h === root
}
function rangeProof(layers: string[][], lo: number, hi: number) {
  const proof: Record<string, string> = {}
  let known = new Set<number>()
  for (let i = lo; i <= hi; i++) known.add(i)
  for (let l = 0; l < layers.length - 1; l++) {
    const next = new Set<number>()
    for (const i of known) { const s = i ^ 1; if (!known.has(s)) proof[l + ":" + s] = layers[l][s]; next.add(i >> 1) }
    known = next
  }
  return proof
}
function rootFromRange(hashes: string[], lo: number, proof: Record<string, string>, height: number) {
  let cur = new Map<number, string>()
  hashes.forEach((h, j) => cur.set(lo + j, h))
  if (lo < 0 || lo + hashes.length > 1 << height) return null
  for (let l = 0; l < height; l++) {
    const next = new Map<number, string>()
    for (const [i, h] of cur) {
      const p = i >> 1
      if (next.has(p)) continue
      const s = i ^ 1
      const sh = cur.has(s) ? cur.get(s) : proof[l + ":" + s]
      if (sh === undefined) return null
      next.set(p, i & 1 ? nodeOf(sh, h) : nodeOf(h, sh))
    }
    cur = next
  }
  return cur.size === 1 ? cur.get(0)! : null
}

/* ---------- ball tree (method C) ---------- */
type BallNode =
  | { leaf: true; m: Doc; h: string }
  | { leaf: false; L: BallNode; R: BallNode; c: Pt; rad: number; h: string }
export type BallProof =
  | { t: "leaf"; id: string; x: number; y: number }
  | { t: "cut"; l: string; r: string; c: Pt; rad: number }
  | { t: "node"; c: Pt; rad: number; L: BallProof; R: BallProof }

function buildBall(ms: Doc[]): BallNode {
  if (ms.length === 1) return { leaf: true, m: ms[0], h: leafOf(ms[0]) }
  const xs = ms.map((m) => m.x), ys = ms.map((m) => m.y)
  const ax: "x" | "y" = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys) ? "x" : "y"
  const s = ms.slice().sort((a, b) => a[ax] - b[ax] || (a.id < b.id ? -1 : 1))
  const mid = s.length >> 1
  const L = buildBall(s.slice(0, mid)), R = buildBall(s.slice(mid))
  const c = { x: r6(ms.reduce((t, m) => t + m.x, 0) / ms.length), y: r6(ms.reduce((t, m) => t + m.y, 0) / ms.length) }
  const rad = up6(Math.max(...ms.map((m) => dist(m, c))) + 1e-6)
  return { leaf: false, L, R, c, rad, h: ballHash(L.h, R.h, c, rad) }
}
function proveBall(node: BallNode, q: Pt, rk: number, hiddenId: string | null, view: Map<string, Doc>): BallProof {
  if (node.leaf) { const m = view.get(node.m.id) || node.m; return { t: "leaf", id: m.id, x: m.x, y: m.y } }
  const cut: BallProof = { t: "cut", l: node.L.h, r: node.R.h, c: node.c, rad: node.rad }
  if (hiddenId && ((node.L.leaf && node.L.m.id === hiddenId) || (node.R.leaf && node.R.m.id === hiddenId))) return cut
  if (dist(q, node.c) - node.rad > rk) return cut
  return { t: "node", c: node.c, rad: node.rad, L: proveBall(node.L, q, rk, hiddenId, view), R: proveBall(node.R, q, rk, hiddenId, view) }
}
interface WalkAcc { leaves: Doc[]; cuts: number; nodes: number; err: string | null }
function walkBall(p: BallProof, q: Pt, rk: number, acc: WalkAcc): string {
  if (!p || typeof p !== "object") { acc.err = acc.err || "пошкоджена структура доказу"; return EMPTY }
  if (p.t === "leaf") { acc.leaves.push({ id: p.id, x: p.x, y: p.y }); return leafOf(p) }
  if (p.t === "cut") {
    acc.cuts++
    if (!(dist(q, p.c) - p.rad > rk))
      acc.err = acc.err || `куля (${p.c.x.toFixed(2)}, ${p.c.y.toFixed(2)}) відсічена неправомірно: вона ближча за r_k`
    return ballHash(p.l, p.r, p.c, p.rad)
  }
  acc.nodes++
  return ballHash(walkBall(p.L, q, rk, acc), walkBall(p.R, q, rk, acc), p.c, p.rad)
}
export function forEachBall(p: BallProof | null, fn: (p: BallProof) => void) {
  if (!p) return
  fn(p)
  if (p.t === "node") { forEachBall(p.L, fn); forEachBall(p.R, fn) }
}

/* ---------- corpus + index ---------- */
function makeCorpus(): Doc[] {
  const rnd = mulberry32(7), pts: Doc[] = []
  const blobs = [[0.22, 0.25], [0.72, 0.2], [0.5, 0.52], [0.2, 0.74], [0.78, 0.72], [0.46, 0.86]]
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
  for (let i = 0; i < 150; i++) {
    let x: number, y: number
    if (i % 12 === 5) { x = 0.06 + rnd() * 0.88; y = 0.06 + rnd() * 0.88 }
    else { const b = blobs[i % 6]; x = b[0] + gauss() * 0.075; y = b[1] + gauss() * 0.075 }
    pts.push({ id: "doc-" + String(i).padStart(3, "0"), x: r6(Math.min(0.97, Math.max(0.03, x))), y: r6(Math.min(0.97, Math.max(0.03, y))) })
  }
  const order = pts.map((_, i) => [rnd(), i]).sort((a, b) => a[0] - b[0]).map((a) => a[1])
  return order.map((i) => pts[i])
}
function kmeans(pts: Doc[], K: number, seed: number) {
  const rnd = mulberry32(seed)
  const p0 = pts[Math.floor(rnd() * pts.length)]
  const cs: Pt[] = [{ x: p0.x, y: p0.y }]
  while (cs.length < K) {
    const d2 = pts.map((p) => Math.min(...cs.map((c) => dist(p, c) ** 2)))
    let t = rnd() * d2.reduce((a, b) => a + b, 0), i = 0
    while (i < pts.length - 1 && t > d2[i]) { t -= d2[i]; i++ }
    cs.push({ x: pts[i].x, y: pts[i].y })
  }
  const assignAll = () => pts.map((p) => { let b = 0, bd = Infinity; cs.forEach((c, j) => { const d = dist(p, c); if (d < bd) { bd = d; b = j } }); return b })
  for (let it = 0; it < 30; it++) {
    const a = assignAll()
    cs.forEach((c, j) => {
      const m = pts.filter((_, i) => a[i] === j)
      if (m.length) { c.x = m.reduce((s, p) => s + p.x, 0) / m.length; c.y = m.reduce((s, p) => s + p.y, 0) / m.length }
    })
  }
  cs.forEach((c) => { c.x = r6(c.x); c.y = r6(c.y) })
  return { centroids: cs, assign: assignAll() }
}
export interface Cluster extends CentroidLeaf { members: Member[]; layers: string[][]; ball: BallNode | null }
export interface Index { version: number; clusters: Cluster[]; glayers: string[][]; root: string }
function buildIndex(points: Doc[], version: number): Index {
  const { centroids, assign } = kmeans(points, NLIST, 42)
  const clusters = centroids.map((c, j) => {
    const members = points.filter((_, i) => assign[i] === j).map((p) => ({ ...p, r: dist(p, c) }))
      .sort((a, b) => a.r - b.r || (a.id < b.id ? -1 : 1))
    const layers = buildLayers(members.map(leafOf))
    const ball = members.length ? buildBall(members) : null
    return { id: j, c, members, layers, root: layers[layers.length - 1][0], ball, ballRoot: ball ? ball.h : EMPTY, size: members.length }
  })
  const glayers = buildLayers(clusters.map(cLeaf))
  return { version, clusters, glayers, root: glayers[glayers.length - 1][0] }
}
const CORPUS = makeCorpus()
const IDX_OLD = buildIndex(CORPUS.slice(0, 130), 1)
export const IDX_CUR = buildIndex(CORPUS, 2)
const CHAIN = [{ version: 1, root: IDX_OLD.root }, { version: 2, root: IDX_CUR.root }]
const LATEST = 2

/* ---------- untrusted server ---------- */
interface Result extends Doc { cid: number }
interface Range { cid: number; lo: number; leaves: Doc[]; proof: Record<string, string> }
export interface Bundle {
  variant: Method
  version: number
  root: string
  nprobe: number
  probed: number[]
  results: Result[]
  hidden?: Result | null
  idx?: Index
  centroids: (CentroidLeaf & { dist?: number; sib?: string[] })[]
  resProofs?: (Result & { index: number; sib: string[] })[]
  ranges?: Range[]
  balls?: { cid: number; tree: BallProof | null }[]
}

export function serve(q: Pt, k: number, nprobe: number, variant: Method, attack: Attack): Bundle {
  const idx = attack === "rollback" ? IDX_OLD : IDX_CUR
  const cds = idx.clusters.map((cl) => ({ id: cl.id, d: dist(q, cl.c) })).sort((a, b) => a.d - b.d)
  let probed = cds.slice(0, nprobe).map((x) => x.id)
  const reported = new Map(cds.map((x) => [x.id, x.d]))
  if (attack === "centroid" && nprobe < NLIST) {
    probed = cds.slice(1, nprobe + 1).map((x) => x.id)
    reported.set(cds[0].id, cds[nprobe].d); reported.set(cds[nprobe].id, cds[0].d)
  }
  const view = new Map<string, Doc>()
  for (const id of probed) for (const m of idx.clusters[id].members) view.set(m.id, { id: m.id, x: m.x, y: m.y })
  let cand: { m: Doc; cid: number; d: number }[] = []
  for (const id of probed) for (const m of idx.clusters[id].members) cand.push({ m: view.get(m.id)!, cid: id, d: dist(q, m) })
  cand.sort((a, b) => a.d - b.d)
  let hidden: Result | null = null
  if (attack === "hide" && cand.length > k) { hidden = { ...cand[0].m, cid: cand[0].cid }; view.delete(hidden.id); cand = cand.slice(1) }
  const top = cand.slice(0, k)
  if (attack === "tamper" && top.length) { const t = top[0].m; t.x = r6(t.x + (q.x - t.x) * 0.5); t.y = r6(t.y + (q.y - t.y) * 0.5) }
  const results = top.map((c) => ({ id: c.m.id, x: c.m.x, y: c.m.y, cid: c.cid }))
  const cent = (cl: Cluster): CentroidLeaf => ({ id: cl.id, c: cl.c, root: cl.root, ballRoot: cl.ballRoot, size: cl.size })
  const b: Bundle = { variant, version: idx.version, root: idx.root, nprobe, probed, results, hidden, idx, centroids: [] }
  if (variant === "V0") {
    b.centroids = idx.clusters.map((cl) => ({ ...cent(cl), dist: reported.get(cl.id), sib: inclusionProof(idx.glayers, cl.id) }))
    b.resProofs = results.map((r) => {
      const cl = idx.clusters[r.cid]
      const li = cl.members.findIndex((m) => m.id === r.id)
      return { ...r, index: li, sib: inclusionProof(cl.layers, li) }
    })
    return b
  }
  b.centroids = idx.clusters.map(cent)
  const rk = results.length ? Math.max(...results.map((r) => dist(q, r))) : 0
  if (variant === "C") {
    b.balls = probed.map((id) => ({ cid: id, tree: idx.clusters[id].ball ? proveBall(idx.clusters[id].ball!, q, rk, hidden && hidden.id, view) : null }))
    return b
  }
  b.ranges = probed.map((id) => {
    const cl = idx.clusters[id], n = cl.size
    let a = 0, z = n - 1
    if (variant === "B") {
      const dqc = dist(q, cl.c)
      let lo = 0; while (lo < n && cl.members[lo].r < dqc - rk) lo++
      let hi = n - 1; while (hi >= 0 && cl.members[hi].r > dqc + rk) hi--
      a = Math.max(0, lo - 1); z = Math.min(n - 1, hi + 1)
    }
    const leaves: Doc[] = []
    for (let i = a; i <= z; i++) { const m = view.get(cl.members[i].id); if (m) leaves.push({ id: m.id, x: m.x, y: m.y }) }
    const proof = variant === "B" && leaves.length ? rangeProof(cl.layers, a, a + leaves.length - 1) : {}
    return { cid: id, lo: a, leaves, proof }
  })
  return b
}

/* ---------- client verifier ---------- */
export interface Step { label: string; status: StepStatus; detail: string }

export function verify(b: Bundle, q: Pt, k: number): { steps: Step[]; accepted: boolean } {
  const steps: Step[] = []
  const add = (label: string, status: StepStatus, detail: string) => steps.push({ label, status, detail })
  const anchor = CHAIN.find((a) => a.version === b.version)
  add("Корінь збігається з анкором у ланцюжку", anchor && anchor.root === b.root ? "ok" : "fail",
    `getRoot(v${b.version}) = ${anchor ? short(anchor.root) : "немає анкора"}`)
  if (b.variant === "V0") add("Версія індексу найсвіжіша", "skip", "не перевіряється")
  else add("Версія індексу найсвіжіша", b.version === LATEST ? "ok" : "fail",
    b.version === LATEST ? `v${b.version} = latestVersion` : `v${b.version} < latestVersion = v${LATEST}`)
  const croot = new Map(b.centroids.map((c) => [c.id, c]))
  if (b.variant === "V0") {
    const bad = b.centroids.filter((c) => !verifyInclusion(cLeaf(c), c.id, c.sib!, b.root))
    add("Центроїди автентифіковані", bad.length ? "fail" : "ok", bad.length ? `кластер ${bad[0].id}: доказ включення хибний` : `${b.centroids.length} доказів включення`)
    const exp = new Set([...b.centroids].sort((x, y) => x.dist! - y.dist!).slice(0, b.nprobe).map((c) => c.id))
    const okSel = b.probed.every((id) => exp.has(id))
    add("Вибір кластерів чесний", okSel ? "trust" : "fail", okSel ? "за відстанями, які надіслав сам сервер" : "кластер поза top-nprobe")
    const badR = b.resProofs!.find((r) => { const c = croot.get(r.cid); return !c || !verifyInclusion(leafOf(r), r.index, r.sib, c.root) })
    add("Результати є в індексі", badR ? "fail" : "ok", badR ? `${badR.id}: хеш не сходиться до кореня кластера` : `${b.resProofs!.length} доказів включення`)
    add("Нічого не приховано", "skip", "клієнт бачить лише k результатів")
    add("Top-k перераховано клієнтом", "skip", "не перевіряється")
  } else {
    const gOk = b.centroids.length === NLIST && rootOf(b.centroids.map(cLeaf)) === b.root
    add("Центроїди автентифіковані", gOk ? "ok" : "fail", gOk ? `globalRoot перераховано з ${NLIST} листків` : "globalRoot не відтворюється")
    const mine = b.centroids.map((c) => ({ id: c.id, d: dist(q, c.c) })).sort((x, y) => x.d - y.d).slice(0, b.nprobe).map((c) => c.id)
    const selOk = mine.length === b.probed.length && mine.every((id) => b.probed.includes(id))
    add("Вибір кластерів чесний", selOk ? "ok" : "fail", selOk ? `власні відстані: {${mine.join(", ")}}` : `мають бути {${mine.join(", ")}}, сервер узяв {${b.probed.join(", ")}}`)
    const rk = b.results.length ? Math.max(...b.results.map((r) => dist(q, r))) : 0
    const revealed = new Map<string, Result>()
    let compl: string | null = null, nRev = 0, extra = ""
    if (b.variant === "C") {
      let cuts = 0
      for (const bl of b.balls!) {
        const c = croot.get(bl.cid)!
        const acc: WalkAcc = { leaves: [], cuts: 0, nodes: 0, err: null }
        const h = bl.tree ? walkBall(bl.tree, q, rk, acc) : EMPTY
        cuts += acc.cuts
        acc.leaves.forEach((l) => revealed.set(l.id, { ...l, cid: bl.cid }))
        nRev += acc.leaves.length
        if (!compl && acc.err) compl = `кластер ${bl.cid}: ${acc.err}`
        if (!compl && h !== c.ballRoot) compl = `кластер ${bl.cid}: корінь ball-tree ≠ закомічений`
      }
      extra = `${nRev} листків, ${cuts} куль відсічено за межею r_k = ${rk.toFixed(3)}`
    } else {
      for (const rg of b.ranges!) {
        const c = croot.get(rg.cid)!
        rg.leaves.forEach((l) => revealed.set(l.id, { ...l, cid: rg.cid }))
        nRev += rg.leaves.length
        if (compl) continue
        const hashes = rg.leaves.map(leafOf)
        const got = b.variant === "A"
          ? rg.leaves.length === c.size ? rootOf(hashes) : null
          : rootFromRange(hashes, rg.lo, rg.proof, heightFor(c.size))
        if (got !== c.root) { compl = `кластер ${rg.cid}: корінь ${b.variant === "A" ? "кластера" : "діапазону"} ≠ закомічений`; continue }
        if (b.variant === "B" && rg.leaves.length) {
          const dqc = dist(q, c.c), f = rg.leaves[0], l = rg.leaves[rg.leaves.length - 1]
          if (!(rg.lo === 0 || dist(f, c.c) < dqc - rk)) compl = `кластер ${rg.cid}: ліва межа всередині кільця`
          else if (!(rg.lo + rg.leaves.length - 1 === c.size - 1 || dist(l, c.c) > dqc + rk)) compl = `кластер ${rg.cid}: права межа всередині кільця`
        }
      }
      extra = b.variant === "A" ? `${nRev} листків, корені кластерів відтворено` : `r_k = ${rk.toFixed(3)}, ${nRev} листків у кільцях, межі поза кільцем`
    }
    const badR = b.results.find((r) => { const l = revealed.get(r.id); return !l || l.x !== r.x || l.y !== r.y || l.cid !== r.cid })
    add("Результати є в індексі", badR ? "fail" : "ok", badR ? `${badR.id} не збігається з розкритими листками` : "кожен результат є в автентифікованих даних")
    add("Нічого не приховано", compl ? "fail" : "ok", compl || extra)
    const all = [...revealed.values()].map((l) => ({ id: l.id, d: dist(q, l) })).sort((x, y) => x.d - y.d).slice(0, k).map((l) => l.id)
    const same = all.length === b.results.length && all.every((id, i) => id === b.results[i].id)
    add("Top-k перераховано клієнтом", same ? "ok" : "fail", same ? "збігається з відповіддю сервера" : `очікувано ${all.slice(0, 3).join(", ")}…`)
  }
  return { steps, accepted: !steps.some((s) => s.status === "fail") }
}

export function stats(b: Bundle) {
  let vec: number, hashes: number, dists: number
  if (b.variant === "V0") {
    vec = b.results.length + NLIST
    hashes = b.centroids.reduce((s, c) => s + c.sib!.length + 2, 0) + b.resProofs!.reduce((s, r) => s + r.sib.length, 0)
    dists = 0
  } else if (b.variant === "C") {
    let lv = 0, nd = 0, ct = 0
    b.balls!.forEach((bl) => forEachBall(bl.tree, (p) => { if (p.t === "leaf") lv++; else if (p.t === "cut") ct++; else nd++ }))
    vec = lv + nd + ct + NLIST; hashes = NLIST * 2 + ct * 2; dists = lv + nd + ct + NLIST
  } else {
    const n = b.ranges!.reduce((s, r) => s + r.leaves.length, 0)
    vec = n + NLIST; hashes = NLIST * 2 + b.ranges!.reduce((s, r) => s + Object.keys(r.proof).length, 0); dists = n + NLIST
  }
  return { vec, hashes, dists, kb: (vec * DIM_BYTES + hashes * HASH_BYTES) / 1024 }
}

/** Revealed leaf ids and the two range boundaries per cluster, for drawing. */
export function revealedIds(b: Bundle) {
  const ids = new Set<string>(), bounds = new Set<string>()
  b.ranges?.forEach((r) => {
    r.leaves.forEach((l) => ids.add(l.id))
    if (b.variant === "B" && r.leaves.length) { bounds.add(r.leaves[0].id); bounds.add(r.leaves[r.leaves.length - 1].id) }
  })
  b.balls?.forEach((bl) => forEachBall(bl.tree, (p) => { if (p.t === "leaf") ids.add(p.id) }))
  return { ids, bounds }
}

/* ---------- receipts ---------- */
export interface SearchReceipt {
  type: "simulated-search-receipt"
  v: 1
  method: Method
  query: Pt
  k: number
  indexVersion: number
  globalRoot: string
  nprobe: number
  probed: number[]
  results: Result[]
  centroids: Bundle["centroids"]
  resProofs?: Bundle["resProofs"]
  ranges?: Bundle["ranges"]
  balls?: Bundle["balls"]
}

export function toReceipt(b: Bundle, q: Pt, k: number): SearchReceipt {
  return {
    type: "simulated-search-receipt", v: 1, method: b.variant, query: { x: r6(q.x), y: r6(q.y) }, k,
    indexVersion: b.version, globalRoot: b.root, nprobe: b.nprobe, probed: b.probed, results: b.results,
    centroids: b.centroids, resProofs: b.resProofs, ranges: b.ranges, balls: b.balls,
  }
}

export function verifyReceipt(o: SearchReceipt) {
  const b: Bundle = {
    variant: o.method, version: o.indexVersion, root: o.globalRoot, nprobe: o.nprobe, probed: o.probed,
    results: o.results, centroids: o.centroids, resProofs: o.resProofs, ranges: o.ranges, balls: o.balls,
  }
  return verify(b, o.query, o.k)
}

/* ---------- benchmark ---------- */
export const ATTACKS: Exclude<Attack, "none">[] = ["hide", "centroid", "tamper", "rollback"]
export const METHODS: Method[] = ["V0", "A", "B", "C"]

export function bench(k: number, nprobe: number, queries = 80) {
  const rnd = mulberry32(99), Q: Pt[] = []
  for (let i = 0; i < queries; i++) Q.push({ x: 0.05 + rnd() * 0.9, y: 0.05 + rnd() * 0.9 })
  const avgKb = {} as Record<Method, number>
  const detection = {} as Record<Method, Record<string, number | null>>
  for (const m of METHODS) {
    avgKb[m] = Q.reduce((s, q) => s + stats(serve(q, k, nprobe, m, "none")).kb, 0) / Q.length
    detection[m] = {}
    for (const a of ATTACKS) {
      let caught = 0, n = 0
      for (const q of Q) {
        const b = serve(q, k, nprobe, m, a)
        if (a === "hide" && !b.hidden) continue
        n++
        if (!verify(b, q, k).accepted) caught++
      }
      detection[m][a] = n ? caught / n : null
    }
  }
  return { avgKb, detection }
}
