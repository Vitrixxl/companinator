import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import dagre from "dagre"
import { format } from "date-fns"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarPlus,
  ChevronRight,
  ChevronsRight,
  FileText,
  GitBranch,
  Globe2,
  Heart,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  Lock,
  MapPin,
  MessageSquare,
  MessageCircle,
  Network,
  Newspaper,
  Plus,
  Quote,
  ScanSearch,
  Search,
  Send,
  Shield,
  Sigma,
  Sparkles,
  Sun,
  Users,
  Upload,
  X,
} from "lucide-react"
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"

import "@xyflow/react/dist/style.css"

import type {
  AssistantResponseDTO,
  CommunityPostDTO,
  ConversationDTO,
  EmployeeDTO,
  EmployeeEventDTO,
  MessageDTO,
  SystemCompanyDTO,
} from "@workspace/shared"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Separator } from "@workspace/ui/components/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Switch } from "@workspace/ui/components/switch"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"

import {
  WS_URL,
  assetUrl,
  createEmployee,
  createConversation,
  createEvent,
  createGroup,
  createPost,
  createSuperAdminCompany,
  getAdminConversations,
  getConversations,
  getDashboard,
  getEmployeeEvents,
  getEmployees,
  getGroups,
  getHierarchy,
  getMe,
  getMessages,
  getPosts,
  getSuperAdminCompanies,
  importHierarchyCsv,
  sendMessage,
  signIn,
  signOut,
  streamAssistant,
  type AssistantStreamMetadata,
  type DashboardResponse,
  type HierarchyResponse,
  updateCompanySettings,
} from "./lib/api"

const queryClient = new QueryClient()

type Section =
  | "dashboard"
  | "hierarchy"
  | "employees"
  | "assistant"
  | "messages"
  | "community"
  | "groups"
  | "admin"
  | "superAdmin"

type NavGroup = "workspace" | "community" | "governance"

const sections: Array<{
  id: Section
  number: string
  label: string
  group: NavGroup
  icon: typeof LayoutDashboard
}> = [
  { id: "dashboard", number: "01", group: "workspace", label: "Pilotage", icon: LayoutDashboard },
  { id: "hierarchy", number: "02", group: "workspace", label: "Hierarchie", icon: GitBranch },
  { id: "employees", number: "03", group: "workspace", label: "Employes", icon: Users },
  { id: "assistant", number: "04", group: "workspace", label: "Assistant", icon: Sparkles },
  { id: "messages", number: "05", group: "community", label: "Messages", icon: MessageSquare },
  { id: "community", number: "06", group: "community", label: "Communaute", icon: Newspaper },
  { id: "groups", number: "07", group: "community", label: "Groupes", icon: Building2 },
  { id: "admin", number: "08", group: "governance", label: "Admin", icon: Shield },
  { id: "superAdmin", number: "09", group: "governance", label: "Gros Admin", icon: Globe2 },
]

const navGroupLabels: Record<NavGroup, string> = {
  workspace: "Workspace",
  community: "Communaute",
  governance: "Gouvernance",
}

const sectionCopy: Record<Section, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard: {
    eyebrow: "Edition courante · Synthese",
    title: "Pilotage",
    subtitle: "Synthese temps reel de l'organisation et des canaux internes.",
  },
  hierarchy: {
    eyebrow: "Cartographie · Structure",
    title: "Hierarchie",
    subtitle: "Vue manageriale, rattachements et responsabilites de l'entreprise.",
  },
  employees: {
    eyebrow: "Annuaire · Profils",
    title: "Employes",
    subtitle: "Annuaire complet, postes et descriptions vectorisees par embedding.",
  },
  assistant: {
    eyebrow: "Recherche · IA semantique",
    title: "Assistant",
    subtitle: "Recherche de profils disponibles via embeddings locaux et pgvector.",
  },
  messages: {
    eyebrow: "Conversations · Direct",
    title: "Messages",
    subtitle: "Conversations directes et canaux internes par equipe.",
  },
  community: {
    eyebrow: "Editorial · Annonces",
    title: "Communaute",
    subtitle: "Publications, annonces et chronique interne de l'entreprise.",
  },
  groups: {
    eyebrow: "Collectifs · Squads",
    title: "Groupes",
    subtitle: "Collectifs, squads et cercles de travail au sein de l'entreprise.",
  },
  admin: {
    eyebrow: "Gouvernance · Confidentialite",
    title: "Admin",
    subtitle: "Droits de lecture, audit et politique de confidentialite.",
  },
  superAdmin: {
    eyebrow: "Plateforme · Multi-tenant",
    title: "Gros Admin",
    subtitle: "Creation et pilotage des entreprises clientes.",
  },
}

type DepartmentTone = {
  label: string
  bar: string
  chip: string
  avatar: string
  soft: string
  dot: string
  text: string
  accent: string
  edge: string
}

function departmentTone(department: string | null | undefined): DepartmentTone {
  const normalized = (department ?? "Equipe").toLowerCase()

  if (normalized.includes("engineering") || normalized.includes("data")) {
    return {
      label: department ?? "Engineering",
      bar: "bg-emerald-500",
      chip: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
      avatar:
        "bg-emerald-100 text-emerald-950 ring-emerald-200 dark:bg-emerald-900 dark:text-emerald-50 dark:ring-emerald-700",
      soft: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
      dot: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-300",
      accent: "border-l-emerald-500",
      edge: "oklch(0.696 0.17 162.48)",
    }
  }

  if (normalized.includes("produit") || normalized.includes("product")) {
    return {
      label: department ?? "Produit",
      bar: "bg-blue-500",
      chip: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100",
      avatar:
        "bg-blue-100 text-blue-950 ring-blue-200 dark:bg-blue-900 dark:text-blue-50 dark:ring-blue-700",
      soft: "bg-blue-500/10 text-blue-900 dark:text-blue-100",
      dot: "bg-blue-500",
      text: "text-blue-700 dark:text-blue-300",
      accent: "border-l-blue-500",
      edge: "oklch(0.623 0.214 259.815)",
    }
  }

  if (normalized.includes("sales") || normalized.includes("success") || normalized.includes("support")) {
    return {
      label: department ?? "Sales",
      bar: "bg-amber-500",
      chip: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
      avatar:
        "bg-amber-100 text-amber-950 ring-amber-200 dark:bg-amber-900 dark:text-amber-50 dark:ring-amber-700",
      soft: "bg-amber-500/10 text-amber-950 dark:text-amber-100",
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-300",
      accent: "border-l-amber-500",
      edge: "oklch(0.769 0.188 70.08)",
    }
  }

  if (normalized.includes("people") || normalized.includes("rh")) {
    return {
      label: department ?? "People",
      bar: "bg-rose-500",
      chip: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
      avatar:
        "bg-rose-100 text-rose-950 ring-rose-200 dark:bg-rose-900 dark:text-rose-50 dark:ring-rose-700",
      soft: "bg-rose-500/10 text-rose-950 dark:text-rose-100",
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-300",
      accent: "border-l-rose-500",
      edge: "oklch(0.645 0.246 16.439)",
    }
  }

  if (normalized.includes("finance") || normalized.includes("direction")) {
    return {
      label: department ?? "Direction",
      bar: "bg-slate-500",
      chip: "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100",
      avatar:
        "bg-slate-100 text-slate-950 ring-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:ring-slate-600",
      soft: "bg-slate-500/10 text-slate-900 dark:text-slate-100",
      dot: "bg-slate-500",
      text: "text-slate-700 dark:text-slate-300",
      accent: "border-l-slate-500",
      edge: "oklch(0.554 0.046 257.417)",
    }
  }

  return {
    label: department ?? "Equipe",
    bar: "bg-cyan-500",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100",
    avatar:
      "bg-cyan-100 text-cyan-950 ring-cyan-200 dark:bg-cyan-900 dark:text-cyan-50 dark:ring-cyan-700",
    soft: "bg-cyan-500/10 text-cyan-950 dark:text-cyan-100",
    dot: "bg-cyan-500",
    text: "text-cyan-700 dark:text-cyan-300",
    accent: "border-l-cyan-500",
    edge: "oklch(0.715 0.143 215.221)",
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function employeeHandle(employee: Pick<EmployeeDTO, "name">) {
  return employee.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function slugifyCompanyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—"
  return format(new Date(value), "dd MMM, HH:mm")
}

function hierarchyFromEmployees(employees: EmployeeDTO[]): HierarchyResponse {
  return {
    nodes: employees.map((employee) => ({ id: employee.id, employee })),
    edges: employees
      .filter((employee) => employee.managerId)
      .map((employee) => ({
        id: `${employee.managerId}-${employee.id}`,
        source: employee.managerId!,
        target: employee.id,
      })),
  }
}

function mergeEmployees(current: EmployeeDTO[], imported: EmployeeDTO[]) {
  const byId = new Map(current.map((employee) => [employee.id, employee]))
  for (const employee of imported) {
    byId.set(employee.id, employee)
  }
  return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name))
}

function applyHierarchyImportCache(
  client: ReturnType<typeof useQueryClient>,
  companyId: string,
  result: { employees: EmployeeDTO[] },
) {
  const currentEmployees = client.getQueryData<EmployeeDTO[]>(["employees", companyId])
  const currentHierarchy = client.getQueryData<HierarchyResponse>(["hierarchy", companyId])
  const baseEmployees = currentEmployees ?? currentHierarchy?.nodes.map((node) => node.employee) ?? []
  const mergedEmployees = mergeEmployees(baseEmployees, result.employees)

  client.setQueryData<EmployeeDTO[]>(["employees", companyId], mergedEmployees)
  client.setQueryData<HierarchyResponse>(["hierarchy", companyId], hierarchyFromEmployees(mergedEmployees))
  client.setQueryData<DashboardResponse>(["dashboard", companyId], (current) =>
    current ? { ...current, employees: mergedEmployees.length } : current,
  )
  client.setQueryData<SystemCompanyDTO[]>(["super-admin-companies"], (current) =>
    current?.map((company) =>
      company.id === companyId ? { ...company, employeeCount: mergedEmployees.length } : company,
    ),
  )
}

function isoWeek(date: Date) {
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7))
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}

function localDateTime(offsetHours: number) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000)
  date.setMinutes(0, 0, 0)
  return date.toISOString().slice(0, 16)
}

// ─────────────────────────────────────────────────────────────
//  Login screen — editorial cover page
// ─────────────────────────────────────────────────────────────

function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("admin@acme.local")
  const [password, setPassword] = useState("Companinator123!")
  const mutation = useMutation({
    mutationFn: () => signIn(email, password),
    onSuccess: onSignedIn,
  })

  const now = new Date()
  return (
    <main className="editorial-shell relative grid min-h-svh place-items-center px-6 py-10">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border bg-card shadow-sm ring-1 ring-foreground/5 lg:grid-cols-[1.05fr_1fr]">
        <section className="relative flex flex-col justify-between gap-10 border-b bg-gradient-to-br from-primary/8 via-card to-card p-10 lg:border-b-0 lg:border-r">
          <header className="flex items-center justify-between">
            <span className="eyebrow">Companinator · Edition {format(now, "yyyy")}</span>
            <span className="eyebrow tabular">N°{String(isoWeek(now)).padStart(2, "0")}</span>
          </header>
          <div className="grid gap-6">
            <div className="flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                <GitBranch className="size-5" />
              </div>
              <span className="font-heading text-xl font-medium tracking-tight">Companinator</span>
            </div>
            <h1 className="editorial-title text-5xl md:text-6xl">
              La revue
              <br />
              <span className="text-primary">interne</span> de votre
              <br />
              entreprise.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Annuaire, organigramme et assistant IA semantique reunis dans un meme espace, pense comme une
              edition hebdomadaire de votre organisation.
            </p>
          </div>
          <footer className="grid gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="rubric text-primary">Ollama</span>
              <span className="rubric text-emerald-700 dark:text-emerald-400">pgvector</span>
              <span className="rubric text-slate-600 dark:text-slate-400">Postgres</span>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {format(now, "EEEE, dd LLLL yyyy")}
            </p>
          </footer>
        </section>
        <section className="grid gap-6 p-10">
          <header className="grid gap-2">
            <span className="eyebrow">Acces · Espace entreprise</span>
            <h2 className="editorial-title text-3xl">Connexion</h2>
            <p className="text-sm text-muted-foreground">
              Saisis tes identifiants pour acceder a l'espace.
            </p>
          </header>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email" className="eyebrow-tight">
                Email
              </Label>
              <Input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="eyebrow-tight">
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {mutation.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {mutation.error.message}
              </div>
            ) : null}
            <Button type="submit" disabled={mutation.isPending} size="lg">
              <KeyRound />
              {mutation.isPending ? "Connexion..." : "Acceder a l'espace"}
            </Button>
            <Separator />
            <div className="grid gap-1 text-xs text-muted-foreground">
              <p className="eyebrow-tight">Demo</p>
              <p className="font-mono">admin@acme.local · Companinator123!</p>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────
//  Page openers and shared editorial pieces
// ─────────────────────────────────────────────────────────────

function PageOpener({
  marker,
  eyebrow,
  title,
  description,
  meta,
}: {
  marker?: string
  eyebrow?: string
  title: string
  description?: string
  meta?: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 border-b pb-6">
      <div className="flex items-center gap-4">
        {marker ? (
          <span className="section-marker text-xs tracking-widest text-muted-foreground">§ {marker}</span>
        ) : null}
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="grid gap-2">
          <h2 className="editorial-title text-4xl md:text-5xl">{title}</h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {meta ? <div className="flex flex-wrap items-center gap-3">{meta}</div> : null}
      </div>
    </section>
  )
}

function SectionLabel({ marker, children }: { marker?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="eyebrow">{children}</span>
      <span className="toc-leader" aria-hidden />
      {marker ? <span className="section-marker text-xs text-muted-foreground">§ {marker}</span> : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Dashboard — editorial cover
// ─────────────────────────────────────────────────────────────

function MetricFigure({
  label,
  value,
  detail,
  trend,
  loading,
  large,
}: {
  label: string
  value: number
  detail: string
  trend?: "up" | "down" | null
  loading: boolean
  large?: boolean
}) {
  return (
    <div className="grid gap-2 border-l pl-5">
      <span className="eyebrow-tight">{label}</span>
      <div className="flex items-baseline gap-3">
        <span className={large ? "metric-figure" : "metric-figure-sm"}>{loading ? "—" : value}</span>
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              trend === "up" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400",
            )}
          >
            {trend === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            <span className="tabular">{trend === "up" ? "+12%" : "-3%"}</span>
          </span>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  )
}

function DashboardPage({
  companyId,
  employees,
  posts,
  conversations,
  companyName,
}: {
  companyId: string
  employees: EmployeeDTO[]
  posts: CommunityPostDTO[]
  conversations: ConversationDTO[]
  companyName: string
}) {
  const dashboard = useQuery({ queryKey: ["dashboard", companyId], queryFn: () => getDashboard(companyId) })

  const departmentBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const employee of employees) {
      const key = employee.department ?? "Equipe"
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const total = employees.length || 1
    return Array.from(counts.entries())
      .map(([department, count]) => ({
        department,
        count,
        ratio: count / total,
        tone: departmentTone(department),
      }))
      .sort((a, b) => b.count - a.count)
  }, [employees])

  const activityFeed = useMemo(() => {
    const items: Array<{
      id: string
      kind: "post" | "conversation"
      title: string
      detail: string
      author: string
      date: string
      tone: DepartmentTone
    }> = []
    for (const post of posts.slice(0, 4)) {
      const author = employees.find((employee) => employee.id === post.authorEmployeeId)
      items.push({
        id: `post-${post.id}`,
        kind: "post",
        title: post.title || "Annonce interne",
        detail: post.body.slice(0, 110),
        author: author?.name ?? "Equipe",
        date: post.createdAt,
        tone: departmentTone(author?.department),
      })
    }
    for (const conv of conversations.slice(0, 3)) {
      items.push({
        id: `conv-${conv.id}`,
        kind: "conversation",
        title: conv.title ?? "Conversation directe",
        detail: `${conv.participantEmployeeIds.length} participants`,
        author: conv.type === "group" ? "Groupe" : "Direct",
        date: conv.lastMessageAt ?? conv.createdAt,
        tone: departmentTone(null),
      })
    }
    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
  }, [posts, conversations, employees])

  const now = new Date()

  return (
    <div className="editorial-enter grid gap-8">
      {/* Hero stripe */}
      <section className="panel relative grid gap-8 overflow-hidden p-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-6">
          <div className="flex items-center gap-3">
            <span className="eyebrow">Edition {format(now, "LLLL yyyy")} · Semaine {String(isoWeek(now)).padStart(2, "0")}</span>
            <span className="toc-leader" aria-hidden />
            <span className="section-marker text-xs text-muted-foreground">N° {String(isoWeek(now)).padStart(2, "0")}</span>
          </div>
          <h3 className="editorial-title text-3xl md:text-4xl">
            <span className="text-muted-foreground">Synthese de</span> {companyName}
            <span className="text-primary">.</span>
          </h3>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Etat consolide de l'organisation — effectif, agendas, conversations actives et publications de la semaine.
            Toutes les metriques se rafraichissent depuis vos donnees Postgres.
          </p>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <MetricFigure
              large
              label="Profils"
              value={dashboard.data?.employees ?? employees.length}
              detail="Effectif actif"
              trend="up"
              loading={dashboard.isLoading}
            />
            <MetricFigure
              label="Evenements"
              value={dashboard.data?.events ?? 0}
              detail="Creneaux suivis"
              loading={dashboard.isLoading}
            />
            <MetricFigure
              label="Conversations"
              value={dashboard.data?.conversations ?? conversations.length}
              detail="Canaux actifs"
              loading={dashboard.isLoading}
            />
            <MetricFigure
              label="Posts"
              value={dashboard.data?.posts ?? posts.length}
              detail="Annonces internes"
              loading={dashboard.isLoading}
            />
          </div>
        </div>
        {/* Right column: department index */}
        <div className="grid gap-4 border-l pl-8">
          <SectionLabel marker="01.A">Index des equipes</SectionLabel>
          <div className="grid gap-3">
            {departmentBreakdown.slice(0, 5).map((entry) => (
              <div key={entry.department} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", entry.tone.dot)} />
                    <span className="font-medium">{entry.department}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular">
                    {String(entry.count).padStart(2, "0")} / {String(employees.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", entry.tone.bar)}
                    style={{ width: `${Math.max(8, entry.ratio * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {departmentBreakdown.length === 0 ? (
              <div className="hatch h-24 rounded-md" aria-hidden />
            ) : null}
          </div>
        </div>
      </section>

      {/* Two-column editorial: activity ticker + a retenir */}
      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-4">
          <SectionLabel marker="02">L'activite recente</SectionLabel>
          <ol className="grid gap-3">
            {activityFeed.length === 0 ? (
              <li className="hatch grid place-items-center rounded-md py-12 text-xs text-muted-foreground">
                Aucune activite recente
              </li>
            ) : (
              activityFeed.map((item, index) => (
                <li
                  key={item.id}
                  className={cn(
                    "panel grid grid-cols-[auto_1fr_auto] items-start gap-4 px-5 py-4",
                    "transition-colors hover:bg-muted/30",
                  )}
                >
                  <span className="section-marker w-9 text-xs text-muted-foreground tabular">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className={cn("size-2 rounded-full", item.tone.dot)} />
                      <span className="eyebrow-tight">{item.kind === "post" ? "Publication" : "Conversation"}</span>
                      <span className="text-xs text-muted-foreground">— {item.author}</span>
                    </div>
                    <p className="font-heading text-sm font-medium">{item.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {shortDate(item.date)}
                  </span>
                </li>
              ))
            )}
          </ol>
        </div>

        <aside className="grid gap-4">
          <SectionLabel marker="03">A retenir</SectionLabel>
          <div className="panel grid gap-4 p-6">
            <div className="flex items-center gap-3">
              <Quote className="size-6 text-primary" />
              <span className="eyebrow-tight">Manifeste</span>
            </div>
            <p className="font-heading text-base leading-snug">
              "Une organisation lisible est une organisation qui collabore. Le pilotage commence par la
              cartographie."
            </p>
            <Separator />
            <div className="grid gap-2">
              <div className="eyebrow-tight">Stack</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="rounded-md font-mono">B2B SaaS</Badge>
                <Badge variant="outline" className="rounded-md font-mono">pgvector</Badge>
                <Badge variant="outline" className="rounded-md font-mono">Ollama</Badge>
                <Badge variant="outline" className="rounded-md font-mono">embeddinggemma</Badge>
                <Badge variant="outline" className="rounded-md font-mono">React 19</Badge>
                <Badge variant="outline" className="rounded-md font-mono">Hono</Badge>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="grid gap-1">
                <span className="eyebrow-tight">Region</span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Globe2 className="size-3.5" /> EU-West
                </span>
              </div>
              <div className="grid gap-1">
                <span className="eyebrow-tight">Version</span>
                <span className="font-mono">v0.2.1 · prod</span>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Hierarchy — editorial cartography
// ─────────────────────────────────────────────────────────────

type EmployeeNodeData = {
  employee: EmployeeDTO
  managerName: string | null
  reportCount: number
}

type EmployeeFlowNode = Node<EmployeeNodeData, "employee">

const employeeNodeWidth = 296
const employeeNodeHeight = 124

function EmployeeNode({ data, selected }: NodeProps<EmployeeFlowNode>) {
  const tone = departmentTone(data.employee.department)

  return (
    <div
      style={{ "--dept-edge": tone.edge } as CSSProperties}
      className={cn(
        "employee-flow-card group relative w-[296px] overflow-hidden rounded-2xl border border-border/80 bg-card/95 text-card-foreground shadow-sm ring-1 ring-foreground/8 backdrop-blur transition duration-150",
        "hover:-translate-y-0.5 hover:shadow-lg",
        selected && "border-primary/70 shadow-lg ring-2 ring-primary/35",
      )}
    >
      <Handle
        id="target-top"
        className="opacity-0"
        isConnectable={false}
        position={Position.Top}
        type="target"
      />
      <div className="grid gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <span className="eyebrow-tight" style={{ color: undefined }}>
            <span className={cn("inline-block size-1.5 -translate-y-px rounded-full align-middle", tone.dot)} />{" "}
            {tone.label}
          </span>
          {data.reportCount > 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              N+1 · {String(data.reportCount).padStart(2, "0")}
            </span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">IC</span>
          )}
        </div>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl text-xs font-semibold ring-1",
              tone.avatar,
            )}
          >
            {initials(data.employee.name)}
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate font-heading text-sm leading-tight font-medium">
              {data.employee.name}
            </strong>
            <p className="truncate text-xs text-muted-foreground">{data.employee.title}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">@{employeeHandle(data.employee)}</span>
          <span className="truncate">{data.managerName ? `↗ ${data.managerName}` : "Direction"}</span>
        </div>
      </div>
      {[
        ["source-left", "26%"],
        ["source-center", "50%"],
        ["source-right", "74%"],
      ].map(([id, left]) => (
        <Handle
          key={id}
          id={id}
          className="opacity-0"
          isConnectable={false}
          position={Position.Bottom}
          style={{ left }}
          type="source"
        />
      ))}
    </div>
  )
}

const nodeTypes = {
  employee: EmployeeNode,
}

function buildFlow(nodes: EmployeeDTO[], edges: Edge[]): EmployeeFlowNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: "TB", nodesep: 56, ranksep: 88 })
  const employeesById = new Map(nodes.map((employee) => [employee.id, employee]))
  const reportCounts = new Map<string, number>()

  for (const edge of edges) {
    reportCounts.set(edge.source, (reportCounts.get(edge.source) ?? 0) + 1)
  }

  for (const employee of nodes) {
    graph.setNode(employee.id, { width: employeeNodeWidth, height: employeeNodeHeight })
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  return nodes.map((employee) => {
    const position = graph.node(employee.id)
    return {
      id: employee.id,
      type: "employee",
      position: {
        x: position.x - employeeNodeWidth / 2,
        y: position.y - employeeNodeHeight / 2,
      },
      draggable: false,
      selectable: true,
      data: {
        employee,
        managerName: employee.managerId ? employeesById.get(employee.managerId)?.name ?? null : null,
        reportCount: reportCounts.get(employee.id) ?? 0,
      },
    }
  })
}

function HierarchyPage({
  companyId,
  canImportHierarchy,
  onSelectEmployee,
}: {
  companyId: string
  canImportHierarchy: boolean
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const client = useQueryClient()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const hierarchy = useQuery({ queryKey: ["hierarchy", companyId], queryFn: () => getHierarchy(companyId) })
  const importMutation = useMutation({
    mutationFn: (file: File) => importHierarchyCsv(companyId, file),
    onSuccess: (result) => {
      setImportSummary(`${result.created} crees · ${result.updated} mis a jour · ${result.linked} liens`)
      applyHierarchyImportCache(client, companyId, result)
      void client.invalidateQueries({ queryKey: ["hierarchy", companyId] })
      void client.invalidateQueries({ queryKey: ["employees", companyId] })
      void client.invalidateQueries({ queryKey: ["dashboard", companyId] })
      void client.invalidateQueries({ queryKey: ["super-admin-companies"] })
    },
  })
  const hierarchyEmployees = useMemo(
    () => (hierarchy.data?.nodes ?? []).map((node) => node.employee),
    [hierarchy.data?.nodes],
  )
  const employeesById = useMemo(
    () => new Map(hierarchyEmployees.map((employee) => [employee.id, employee])),
    [hierarchyEmployees],
  )
  const flowEdges: Edge[] = useMemo(
    () => {
      const handleIds = ["source-left", "source-center", "source-right"]
      const sourceIndexes = new Map<string, number>()

      return (hierarchy.data?.edges ?? []).map((edge) => {
        const index = sourceIndexes.get(edge.source) ?? 0
        sourceIndexes.set(edge.source, index + 1)
        const sourceTone = departmentTone(employeesById.get(edge.source)?.department)
        return {
          id: edge.id,
          source: edge.source,
          sourceHandle: handleIds[index % handleIds.length],
          target: edge.target,
          targetHandle: "target-top",
          animated: false,
          type: "bezier",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: sourceTone.edge,
            width: 16,
            height: 16,
          },
          style: {
            stroke: sourceTone.edge,
            strokeWidth: 2.1,
          },
        }
      })
    },
    [employeesById, hierarchy.data?.edges],
  )
  const flowNodes = useMemo(() => buildFlow(hierarchyEmployees, flowEdges), [hierarchyEmployees, flowEdges])
  const departments = useMemo(
    () => Array.from(new Set(hierarchyEmployees.map((employee) => employee.department ?? "Equipe"))),
    [hierarchyEmployees],
  )
  const managerIds = useMemo(
    () => new Set(flowEdges.map((edge) => edge.source)),
    [flowEdges],
  )

  return (
    <div className="editorial-enter">
      <div className="panel relative flex h-[calc(100svh-10rem)] min-h-[560px] flex-col overflow-hidden">
        <div className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-4 border-b bg-card/92 px-4 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Network className="size-4" />
            </div>
            <div className="min-w-0">
              <span className="eyebrow">Organigramme</span>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                Cliquez sur une carte pour ouvrir le profil.
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {canImportHierarchy ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (!file) {
                      return
                    }
                    setImportSummary(null)
                    importMutation.mutate(file)
                  }}
                />
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={importMutation.isPending}
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload />
                  {importMutation.isPending ? "Import..." : "Importer CSV"}
                </Button>
                <Button type="button" size="xs" variant="ghost" asChild>
                  <a href="/examples/hierarchy-import.csv" download>
                    <FileText />
                    Exemple
                  </a>
                </Button>
                {importMutation.error ? (
                  <span className="max-w-[18rem] truncate text-xs text-destructive">{importMutation.error.message}</span>
                ) : importSummary ? (
                  <span className="max-w-[18rem] truncate font-mono text-[10px] uppercase tracking-wider text-primary">
                    {importSummary}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="hidden items-center gap-3 text-right sm:flex">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {hierarchyEmployees.length} employes
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {managerIds.size} managers
              </span>
            </div>
            <Separator orientation="vertical" className="hidden h-4 sm:block" />
            <div className="flex max-w-[44rem] flex-wrap justify-end gap-2">
              {departments.map((department) => {
                const tone = departmentTone(department)
                return (
                  <span
                    key={department}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-[11px] font-medium"
                  >
                    <span className={cn("size-2 rounded-full", tone.dot)} />
                    {department}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
        <ReactFlow
          className="org-flow"
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.18 }}
          onNodeClick={(_, node: EmployeeFlowNode) => onSelectEmployee(node.data.employee)}
        >
          <Background color="oklch(0.709 0.01 56.259)" gap={28} size={1} />
          <Controls className="org-flow-controls" showInteractive={false} />
        </ReactFlow>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Employees — directory
// ─────────────────────────────────────────────────────────────

function EmployeesPage({
  companyId,
  employees,
  onSelectEmployee,
}: {
  companyId: string
  employees: EmployeeDTO[]
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const client = useQueryClient()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [title, setTitle] = useState("")
  const [department, setDepartment] = useState("Engineering")
  const [managerId, setManagerId] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [search, setSearch] = useState("")
  const [activeDepartment, setActiveDepartment] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      createEmployee(companyId, {
        name,
        email: email || null,
        title,
        department,
        managerId: managerId || null,
        jobDescription,
      }),
    onSuccess: () => {
      setName("")
      setEmail("")
      setTitle("")
      setJobDescription("")
      void client.invalidateQueries({ queryKey: ["employees", companyId] })
      void client.invalidateQueries({ queryKey: ["hierarchy", companyId] })
    },
  })

  const departments = useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department ?? "Equipe"))),
    [employees],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return employees.filter((employee) => {
      const matchesQ =
        !q ||
        employee.name.toLowerCase().includes(q) ||
        employee.title.toLowerCase().includes(q) ||
        (employee.department ?? "").toLowerCase().includes(q)
      const matchesDept = !activeDepartment || (employee.department ?? "Equipe") === activeDepartment
      return matchesQ && matchesDept
    })
  }, [employees, search, activeDepartment])

  return (
    <div className="editorial-enter grid gap-6">
      <PageOpener
        marker="03"
        eyebrow="Annuaire · Profils & embeddings"
        title="L'annuaire."
        description="Profils complets, departements, descriptions de poste — tout est vectorise dans pgvector pour alimenter la recherche semantique."
        meta={
          <div className="flex items-end gap-6">
            <div className="grid gap-1 text-right">
              <span className="metric-figure-sm">{employees.length}</span>
              <span className="eyebrow-tight">Profils actifs</span>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="grid gap-1 text-right">
              <span className="metric-figure-sm">{departments.length}</span>
              <span className="eyebrow-tight">Equipes</span>
            </div>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-4">
          {/* Filter bar */}
          <div className="panel grid gap-4 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Filtrer par nom, poste, departement"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <ListFilter className="size-4 text-muted-foreground" />
                <span className="eyebrow-tight">{filtered.length} resultats</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeDepartment === null ? "secondary" : "outline"}
                size="xs"
                onClick={() => setActiveDepartment(null)}
              >
                Toutes
              </Button>
              {departments.map((dept) => {
                const tone = departmentTone(dept)
                const active = activeDepartment === dept
                return (
                  <Button
                    key={dept}
                    variant={active ? "secondary" : "outline"}
                    size="xs"
                    onClick={() => setActiveDepartment(active ? null : dept)}
                  >
                    <span className={cn("size-1.5 rounded-full", tone.dot)} />
                    {dept}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((employee) => {
              const tone = departmentTone(employee.department)
              return (
                <button
                  key={employee.id}
                  className={cn(
                    "panel group/employee grid grid-cols-[auto_1fr] items-start gap-4 border-l-2 p-4 text-left transition",
                    "hover:-translate-y-0.5 hover:shadow-md hover:bg-muted/20",
                    tone.accent,
                  )}
                  onClick={() => onSelectEmployee(employee)}
                  type="button"
                >
                  <div
                    className={cn(
                      "grid size-12 place-items-center rounded-md text-sm font-semibold ring-1",
                      tone.avatar,
                    )}
                  >
                    {initials(employee.name)}
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="font-heading text-sm font-medium leading-tight">{employee.name}</strong>
                      <ChevronRight className="size-4 text-muted-foreground transition group-hover/employee:translate-x-0.5 group-hover/employee:text-primary" />
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{employee.title}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className={cn("rubric text-xs", tone.text)}>{tone.label}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        @{employeeHandle(employee)}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 ? (
              <div className="hatch col-span-full grid place-items-center rounded-md py-12 text-xs text-muted-foreground">
                Aucun profil ne correspond aux filtres.
              </div>
            ) : null}
          </div>
        </section>

        <aside className="grid gap-3 self-start">
          <Card className="border-0 shadow-sm ring-1 ring-border/70">
            <CardHeader className="gap-2">
              <span className="eyebrow">Ajout · Nouveau profil</span>
              <CardTitle className="font-heading text-xl">Indexer un employe</CardTitle>
              <CardDescription>
                La description de poste alimente directement l'embedding vectoriel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  mutation.mutate()
                }}
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="emp-name" className="eyebrow-tight">Nom</Label>
                  <Input id="emp-name" placeholder="Ada Lovelace" value={name} onChange={(event) => setName(event.target.value)} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="emp-email" className="eyebrow-tight">Email</Label>
                  <Input id="emp-email" placeholder="ada@acme.local" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="emp-title" className="eyebrow-tight">Poste</Label>
                  <Input id="emp-title" placeholder="Engineer" value={title} onChange={(event) => setTitle(event.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="emp-dept" className="eyebrow-tight">Departement</Label>
                    <Input
                      id="emp-dept"
                      placeholder="Engineering"
                      value={department}
                      onChange={(event) => setDepartment(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="emp-manager" className="eyebrow-tight">N+1</Label>
                    <select
                      id="emp-manager"
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={managerId}
                      onChange={(event) => setManagerId(event.target.value)}
                    >
                      <option value="">Aucun</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="emp-jd" className="eyebrow-tight">Description de poste</Label>
                  <Textarea
                    id="emp-jd"
                    className="min-h-24"
                    placeholder="Missions, perimetre, expertise..."
                    value={jobDescription}
                    onChange={(event) => setJobDescription(event.target.value)}
                    required
                  />
                </div>
                {mutation.error ? (
                  <p className="text-xs text-destructive">{mutation.error.message}</p>
                ) : null}
                <Button type="submit" disabled={mutation.isPending}>
                  <Plus />
                  Indexer le profil
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Assistant — research console
// ─────────────────────────────────────────────────────────────

const ASSISTANT_EXAMPLES = [
  "Je voudrais faire un point avec un dev demain",
  "Trouve un product manager dispo cette semaine",
  "Qui peut m'aider sur du data engineering vendredi ?",
  "Reunion finance lundi matin",
]

function AssistantAnswer({
  answer,
  content,
  isStreaming,
  onSelectEmployee,
}: {
  answer: AssistantResponseDTO
  content?: string
  isStreaming?: boolean
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const mentions = new Map(
    answer.candidates.map((candidate) => [
      `@${candidate.handle || employeeHandle(candidate.employee)}`.toLowerCase(),
      candidate.employee,
    ]),
  )
  const parts = (content ?? answer.answer).split(/(@[a-z0-9_]+)/gi)

  return (
    <p className="text-sm leading-relaxed">
      {parts.map((part, index) => {
        const employee = mentions.get(part.toLowerCase())
        if (!employee) {
          return <span key={`${part}-${index}`}>{part}</span>
        }
        return (
          <button
            key={`${part}-${employee.id}-${index}`}
            className="mx-0.5 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-medium text-primary underline-offset-4 transition hover:bg-primary/15 hover:underline"
            onClick={() => onSelectEmployee(employee)}
            type="button"
          >
            {part}
          </button>
        )
      })}
      {isStreaming ? <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-primary align-text-bottom" /> : null}
    </p>
  )
}

type AssistantChatMessage = {
  id: string
  role: "assistant" | "user"
  content: string
  createdAt: Date
  answer?: AssistantResponseDTO
  streamedContent?: string
  isStreaming?: boolean
  isError?: boolean
}

function assistantMessageId(role: AssistantChatMessage["role"]) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function AssistantCandidateCard({
  candidate,
  availabilityChecked,
  onSelectEmployee,
}: {
  candidate: AssistantResponseDTO["candidates"][number]
  index: number
  availabilityChecked: boolean
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const tone = departmentTone(candidate.employee.department)

  return (
    <button
      style={{ "--dept-edge": tone.edge } as CSSProperties}
      className={cn(
        "employee-flow-card group relative w-full overflow-hidden rounded-2xl border border-border/80 bg-card/95 text-left text-card-foreground shadow-sm ring-1 ring-foreground/8 backdrop-blur transition duration-150",
        "hover:shadow-lg",
      )}
      onClick={() => onSelectEmployee(candidate.employee)}
      type="button"
    >
      <div className="grid gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <span className="eyebrow-tight">
            <span className={cn("inline-block size-1.5 -translate-y-px rounded-full align-middle", tone.dot)} />{" "}
            {tone.label}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {availabilityChecked ? (candidate.available ? "Disponible" : "Occupe") : "IC"}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-xl text-xs font-semibold ring-1",
              tone.avatar,
            )}
          >
            {initials(candidate.employee.name)}
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block truncate font-heading text-sm leading-tight font-medium">
              {candidate.employee.name}
            </strong>
            <p className="truncate text-xs text-muted-foreground">{candidate.employee.title}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t pt-2 text-[11px] text-muted-foreground">
          <span className="font-mono uppercase tracking-wider">
            @{candidate.handle || employeeHandle(candidate.employee)}
          </span>
          <span className="truncate">{candidate.reason}</span>
        </div>
      </div>
    </button>
  )
}

function AssistantChatBubble({
  message,
  onSelectEmployee,
}: {
  message: AssistantChatMessage
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const isUser = message.role === "user"
  const visibleAnswer = message.answer
    ? message.streamedContent ?? (message.isStreaming ? "" : message.answer.answer)
    : ""

  return (
    <article className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Sparkles className="size-4" />
        </div>
      ) : null}
      <div
        className={cn(
          "grid max-w-[min(100%,46rem)] gap-4 rounded-2xl border px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.isError
              ? "border-destructive/25 bg-destructive/10 text-destructive"
              : "bg-card",
        )}
      >
        <div className={cn("flex items-center gap-2 text-[11px]", isUser ? "justify-end" : "justify-between")}>
          <span
            className={cn(
              "font-mono uppercase tracking-wider",
              isUser ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {isUser ? "Vous" : "Assistant"}
          </span>
          <span
            className={cn(
              "font-mono uppercase tracking-wider tabular",
              isUser ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {format(message.createdAt, "HH:mm")}
          </span>
        </div>

        {message.answer ? (
          <div className="grid gap-4">
            <AssistantAnswer
              answer={message.answer}
              content={visibleAnswer}
              isStreaming={message.isStreaming}
              onSelectEmployee={onSelectEmployee}
            />
          </div>
        ) : message.content ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : message.isStreaming ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ScanSearch className="size-4 animate-pulse" />
            Analyse des profils et disponibilites...
          </div>
        ) : null}
      </div>
    </article>
  )
}

function AssistantPage({
  companyId,
  onSelectEmployee,
}: {
  companyId: string
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => [
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Bonjour, decris le besoin, le role ou le creneau recherche. Je te proposerai les profils les plus pertinents.",
      createdAt: new Date(),
    },
  ])
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const [isSending, setIsSending] = useState(false)
  const isAssistantStreaming = messages.some((message) => message.isStreaming)
  const isBusy = isSending || isAssistantStreaming
  const userMessageCount = messages.filter((message) => message.role === "user").length
  const citedProfiles = useMemo(() => {
    const seen = new Set<string>()
    const profiles: Array<{
      candidate: AssistantResponseDTO["candidates"][number]
      availabilityChecked: boolean
    }> = []

    for (const message of messages) {
      if (!message.answer) {
        continue
      }

      const visibleContent = (message.streamedContent ?? message.content).toLowerCase()
      for (const candidate of message.answer.candidates) {
        const handle = `@${candidate.handle || employeeHandle(candidate.employee)}`.toLowerCase()
        const name = candidate.employee.name.toLowerCase()

        if (!seen.has(candidate.employee.id) && (visibleContent.includes(handle) || visibleContent.includes(name))) {
          seen.add(candidate.employee.id)
          profiles.push({
            candidate,
            availabilityChecked: Boolean(message.answer.interpretedDate),
          })
        }
      }
    }

    return profiles
  }, [messages])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isSending])

  const submitMessage = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim()
    if (!prompt || isBusy) {
      return
    }

    const assistantId = assistantMessageId("assistant")
    let metadata: AssistantStreamMetadata | null = null
    let streamedAnswer = ""

    setMessages((current) => [
      ...current,
      {
        id: assistantMessageId("user"),
        role: "user",
        content: prompt,
        createdAt: new Date(),
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        streamedContent: "",
        createdAt: new Date(),
        isStreaming: true,
      },
    ])
    setQuery("")
    setIsSending(true)

    try {
      await streamAssistant(companyId, prompt, {
        onMetadata: (nextMetadata) => {
          metadata = nextMetadata
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    answer: { answer: streamedAnswer, ...nextMetadata },
                  }
                : message,
            ),
          )
        },
        onDelta: (delta) => {
          streamedAnswer += delta
          setMessages((current) =>
            current.map((message) => {
              if (message.id !== assistantId) {
                return message
              }

              const answer = metadata
                ? { answer: streamedAnswer, ...metadata }
                : message.answer
                  ? { ...message.answer, answer: streamedAnswer }
                  : undefined

              return {
                ...message,
                content: streamedAnswer,
                streamedContent: streamedAnswer,
                answer,
              }
            }),
          )
        },
        onDone: (answer) => {
          streamedAnswer = answer || streamedAnswer
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: streamedAnswer,
                    streamedContent: streamedAnswer,
                    isStreaming: false,
                    answer: metadata ? { answer: streamedAnswer, ...metadata } : message.answer,
                  }
                : message,
            ),
          )
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur pendant la generation de la reponse."
      setMessages((current) =>
        current.map((row) =>
          row.id === assistantId
            ? {
                id: assistantId,
                role: "assistant",
                content: `Je n'ai pas pu traiter la requete : ${message}`,
                createdAt: new Date(),
                isError: true,
              }
            : row,
        ),
      )
    } finally {
      setIsSending(false)
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId && message.isStreaming
            ? {
                ...message,
                isStreaming: false,
                streamedContent: message.streamedContent ?? message.content,
              }
            : message,
        ),
      )
    }
  }

  return (
    <div className="editorial-enter grid h-full min-h-0">
      <div
        className={cn(
          "grid min-h-0 gap-4",
          citedProfiles.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-1",
        )}
      >
        <section className="panel grid min-h-0 grid-rows-[auto_1fr_auto] overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-card/90 px-5 py-4 backdrop-blur">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="size-5" />
              </div>
              <div className="min-w-0">
                <span className="eyebrow">Conversation</span>
                <h3 className="truncate font-heading text-lg font-medium leading-tight">Chatbot assistant</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-md font-mono">
                {String(userMessageCount).padStart(2, "0")} demandes
              </Badge>
              <Badge variant={isBusy ? "secondary" : "outline"} className="rounded-md font-mono">
                {isAssistantStreaming ? "Generation" : isSending ? "Analyse" : "Pret"}
              </Badge>
            </div>
          </header>

          <ScrollArea className="editorial-scroll min-h-0 px-4 py-5">
            <div className="grid gap-5">
              {messages.map((message) => (
                <AssistantChatBubble
                  key={message.id}
                  message={message}
                  onSelectEmployee={onSelectEmployee}
                />
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t bg-muted/20 p-4">
            <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {ASSISTANT_EXAMPLES.map((example, index) => (
                <button
                  key={example}
                  type="button"
                  disabled={isBusy}
                  onClick={() => void submitMessage(example)}
                  className="group/example grid min-h-24 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left text-sm transition hover:border-primary/40 hover:bg-background disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="font-mono text-[10px] text-muted-foreground tabular">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="line-clamp-2 font-medium leading-snug md:text-base">{example}</span>
                  <ChevronsRight className="size-3.5 text-muted-foreground transition group-hover/example:translate-x-0.5 group-hover/example:text-primary" />
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                void submitMessage(query)
              }}
            >
              <Textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void submitMessage(query)
                  }
                }}
                placeholder="Ex: Trouve un product manager disponible jeudi apres-midi"
                className="max-h-28 min-h-14 resize-none bg-background text-sm leading-relaxed"
              />
              <Button
                type="submit"
                size="icon-lg"
                disabled={!query.trim() || isBusy}
                aria-label="Envoyer"
              >
                <Send />
              </Button>
            </form>
          </div>
        </section>

        {citedProfiles.length > 0 ? (
          <aside className="panel grid min-h-0 grid-rows-[auto_1fr] overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <span className="eyebrow">Profils recommandes</span>
              <Badge variant="outline" className="rounded-md font-mono">
                {String(citedProfiles.length).padStart(2, "0")}
              </Badge>
            </header>
            <ScrollArea className="editorial-scroll min-h-0 p-3">
              <div className="grid gap-3">
                {citedProfiles.map((profile, index) => (
                  <AssistantCandidateCard
                    key={profile.candidate.employee.id}
                    availabilityChecked={profile.availabilityChecked}
                    candidate={profile.candidate}
                    index={index}
                    onSelectEmployee={onSelectEmployee}
                  />
                ))}
            </div>
            </ScrollArea>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Messages — refined direct messaging
// ─────────────────────────────────────────────────────────────

function participantNames(conversation: ConversationDTO | null, employees: EmployeeDTO[]) {
  if (!conversation) {
    return "Selectionne une conversation"
  }

  return conversation.participantEmployeeIds
    .map((id) => employees.find((employee) => employee.id === id)?.name)
    .filter(Boolean)
    .join(", ")
}

function MessageBubble({
  message,
  employees,
  isOwn,
}: {
  message: MessageDTO
  employees: EmployeeDTO[]
  isOwn: boolean
}) {
  const sender = employees.find((employee) => employee.id === message.senderEmployeeId)
  const tone = departmentTone(sender?.department)

  return (
    <div className={cn("flex items-end gap-3", isOwn ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md text-[11px] font-semibold ring-1",
          tone.avatar,
        )}
      >
        {initials(sender?.name ?? "??")}
      </div>
      <div
        className={cn(
          "grid max-w-[70%] gap-1 rounded-lg px-3 py-2 text-sm",
          isOwn
            ? "border border-primary/30 bg-primary/8 text-foreground"
            : "border bg-card",
        )}
      >
        <div
          className={cn(
            "flex items-baseline gap-2 text-[11px] text-muted-foreground",
            isOwn && "flex-row-reverse",
          )}
        >
          <span className="font-medium text-foreground">{sender?.name ?? "Employe"}</span>
          <span className="font-mono uppercase tracking-wider tabular">{shortDate(message.createdAt)}</span>
        </div>
        <p className="leading-relaxed">{message.body}</p>
      </div>
    </div>
  )
}

function MessagesPage({
  companyId,
  employees,
  meEmployeeId,
  selectedConversationId,
  onSelectedConversationOpened,
}: {
  companyId: string
  employees: EmployeeDTO[]
  meEmployeeId: string | null
  selectedConversationId: string | null
  onSelectedConversationOpened: () => void
}) {
  const client = useQueryClient()
  const conversations = useQuery({
    queryKey: ["conversations", companyId],
    queryFn: () => getConversations(companyId),
  })
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const activeConversation = conversations.data?.find((conversation) => conversation.id === conversationId) ?? null
  const messagesQuery = useQuery({
    queryKey: ["messages", companyId, conversationId],
    queryFn: () => getMessages(companyId, conversationId!),
    enabled: Boolean(conversationId),
  })
  const mutation = useMutation({
    mutationFn: () => sendMessage(companyId, conversationId!, message),
    onSuccess: () => {
      setMessage("")
      void client.invalidateQueries({ queryKey: ["messages", companyId, conversationId] })
      void client.invalidateQueries({ queryKey: ["conversations", companyId] })
    },
  })

  useEffect(() => {
    if (selectedConversationId && selectedConversationId !== conversationId) {
      setConversationId(selectedConversationId)
      onSelectedConversationOpened()
      return
    }
    if (selectedConversationId) {
      onSelectedConversationOpened()
    }

    if (!conversationId && conversations.data?.[0]) {
      setConversationId(conversations.data[0].id)
    }
  }, [conversationId, conversations.data, onSelectedConversationOpened, selectedConversationId])

  useEffect(() => {
    if (!conversationId) {
      return undefined
    }
    const socket = new WebSocket(`${WS_URL}/conversations/${conversationId}`)
    socket.onmessage = () => {
      void client.invalidateQueries({ queryKey: ["messages", companyId, conversationId] })
      void client.invalidateQueries({ queryKey: ["conversations", companyId] })
    }
    return () => socket.close()
  }, [client, companyId, conversationId])

  return (
    <div className="editorial-enter grid gap-6">
      <PageOpener
        marker="05"
        eyebrow="Conversations · Temps reel"
        title="Messages."
        description="Conversations directes et canaux par equipe, synchronises en temps reel via WebSocket."
      />

      <div className="grid h-[calc(100svh-22rem)] min-h-[560px] gap-4 lg:grid-cols-[340px_1fr]">
        <div className="panel grid grid-rows-[auto_1fr] overflow-hidden">
          <div className="border-b px-4 py-3">
            <span className="eyebrow">Threads</span>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {(conversations.data ?? []).length} conversations
            </p>
          </div>
          <ScrollArea className="editorial-scroll p-2">
            <div className="grid gap-1.5">
              {(conversations.data ?? []).map((conversation) => {
                const participants = conversation.participantEmployeeIds
                  .map((id) => employees.find((employee) => employee.id === id))
                  .filter(Boolean) as EmployeeDTO[]
                return (
                  <button
                    key={conversation.id}
                    className="thread-card grid gap-2 rounded-md border bg-card p-3 text-left transition hover:bg-muted/30"
                    data-active={conversation.id === conversationId}
                    onClick={() => setConversationId(conversation.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="line-clamp-1 font-heading text-sm font-medium">
                        {conversation.title ?? "Conversation directe"}
                      </strong>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {conversation.type === "group" ? "Groupe" : "Direct"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {participants.slice(0, 4).map((employee) => {
                        const tone = departmentTone(employee.department)
                        return (
                          <span
                            key={employee.id}
                            className={cn(
                              "grid size-6 -ml-1.5 place-items-center rounded-full text-[10px] font-semibold ring-1 first:ml-0",
                              tone.avatar,
                            )}
                            title={employee.name}
                          >
                            {initials(employee.name)}
                          </span>
                        )
                      })}
                      {participants.length > 4 ? (
                        <span className="ml-1 text-[10px] text-muted-foreground tabular">
                          +{participants.length - 4}
                        </span>
                      ) : null}
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {shortDate(conversation.lastMessageAt)}
                    </p>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="panel grid grid-rows-[auto_1fr_auto] overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
            <div>
              <span className="eyebrow">{activeConversation?.type === "group" ? "Canal de groupe" : "Direct"}</span>
              <h3 className="font-heading text-lg font-medium leading-tight">
                {activeConversation?.title ?? "Messages"}
              </h3>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {participantNames(activeConversation, employees)}
              </p>
            </div>
            <Badge variant="outline" className="rounded-md font-mono">
              <Activity className="size-3" /> Live
            </Badge>
          </div>
          <ScrollArea className="editorial-scroll min-h-0 p-5">
            <div className="grid gap-4">
              {(messagesQuery.data ?? []).map((row) => (
                <MessageBubble
                  key={row.id}
                  message={row}
                  employees={employees}
                  isOwn={row.senderEmployeeId === meEmployeeId}
                />
              ))}
              {messagesQuery.data && messagesQuery.data.length === 0 ? (
                <div className="hatch grid place-items-center rounded-md py-8 text-xs text-muted-foreground">
                  Aucun message — entamez la conversation
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <form
            className="flex items-center gap-2 border-t bg-muted/20 p-3"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ecrire un message..."
              className="bg-background"
            />
            <Button type="submit" size="icon" disabled={!conversationId || mutation.isPending}>
              <Send />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Community — editorial spread
// ─────────────────────────────────────────────────────────────

function PostVisual({ post }: { post: CommunityPostDTO }) {
  const imageUrl = assetUrl(post.imageUrl)

  if (imageUrl) {
    return (
      <div className="overflow-hidden border-b bg-muted">
        <img alt={post.title} className="aspect-[16/10] w-full object-cover" src={imageUrl} />
      </div>
    )
  }

  return (
    <div className="relative grid aspect-[16/10] place-items-center overflow-hidden border-b bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.22),transparent_38%),linear-gradient(135deg,rgba(59,130,246,0.16),rgba(244,63,94,0.10))] p-10">
      <div className="absolute inset-0 opacity-30">
        <div className="h-full w-full bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.15)_1px,transparent_0)] [background-size:18px_18px]" />
      </div>
      <div className="relative max-w-md text-center">
        <Quote className="mx-auto mb-3 size-6 text-foreground/60" />
        <p className="font-heading text-2xl font-medium leading-tight">{post.title || "Publication interne"}</p>
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{post.body}</p>
      </div>
    </div>
  )
}

function CommunityPostCard({ post, employees, index }: { post: CommunityPostDTO; employees: EmployeeDTO[]; index: number }) {
  const author = employees.find((employee) => employee.id === post.authorEmployeeId)
  const tone = departmentTone(author?.department)

  return (
    <article className="panel overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold ring-1",
              tone.avatar,
            )}
          >
            {initials(author?.name ?? "Equipe")}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <strong className="font-heading text-sm font-medium leading-tight">{author?.name ?? "Equipe"}</strong>
              <span className={cn("rubric text-[10px]", tone.text)}>{tone.label}</span>
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {author?.title ?? "Publication interne"} · {shortDate(post.createdAt)}
            </div>
          </div>
        </div>
        <span className="section-marker text-xs text-muted-foreground tabular">
          № {String(index + 1).padStart(2, "0")}
        </span>
      </header>

      <PostVisual post={post} />

      <div className="grid gap-4 p-5">
        {post.title ? (
          <h3 className="editorial-title text-xl leading-tight">{post.title}</h3>
        ) : null}
        <p className="whitespace-pre-line text-sm leading-relaxed">{post.body}</p>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button size="sm" type="button" variant="ghost">
              <Heart />
              <span className="font-mono text-xs tabular">{Math.floor((index + 1) * 3 + 2)}</span>
            </Button>
            <Button size="sm" type="button" variant="ghost">
              <MessageCircle />
              <span className="font-mono text-xs tabular">{index + 1}</span>
            </Button>
            <Button size="icon-sm" type="button" variant="ghost">
              <Send />
            </Button>
          </div>
          <Button size="icon-sm" type="button" variant="ghost">
            <Bookmark />
          </Button>
        </div>
      </div>
    </article>
  )
}

function CommunityPage({ companyId, employees }: { companyId: string; employees: EmployeeDTO[] }) {
  const client = useQueryClient()
  const posts = useQuery({ queryKey: ["posts", companyId], queryFn: () => getPosts(companyId) })
  const [body, setBody] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => createPost(companyId, { body, imageFile }),
    onSuccess: () => {
      setBody("")
      setImageFile(null)
      void client.invalidateQueries({ queryKey: ["posts", companyId] })
    },
  })

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null)
      return undefined
    }
    const objectUrl = URL.createObjectURL(imageFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [imageFile])

  return (
    <div className="editorial-enter grid gap-6">
      <PageOpener
        marker="06"
        eyebrow="Communaute · Annonces internes"
        title="La chronique."
        description="Le journal interne — publications, annonces et coulisses partagees au sein de l'entreprise."
        meta={
          <div className="grid gap-1 text-right">
            <span className="metric-figure-sm">{(posts.data ?? []).length}</span>
            <span className="eyebrow-tight">Publications</span>
          </div>
        }
      />

      <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,640px)_360px] xl:items-start">
        <div className="grid gap-6">
          {(posts.data ?? []).map((post, index) => (
            <CommunityPostCard key={post.id} index={index} employees={employees} post={post} />
          ))}
          {posts.isLoading ? (
            <div className="hatch grid place-items-center rounded-md py-12 text-xs text-muted-foreground">
              Chargement du feed...
            </div>
          ) : null}
          {!posts.isLoading && (posts.data ?? []).length === 0 ? (
            <div className="panel grid place-items-center gap-2 p-12 text-center">
              <FileText className="size-6 text-muted-foreground" />
              <p className="font-heading text-base">Aucune publication pour le moment</p>
              <p className="text-xs text-muted-foreground">Lance la premiere annonce dans le panneau a droite.</p>
            </div>
          ) : null}
        </div>

        <div className="xl:sticky xl:top-28">
          <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border/70">
            <CardHeader className="gap-2">
              <span className="eyebrow">Publier · Annonce interne</span>
              <CardTitle className="font-heading text-xl">Nouvelle parution</CardTitle>
              <CardDescription>Image facultative, legende libre.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  mutation.mutate()
                }}
              >
                <label className="grid cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed bg-muted/30 text-sm transition hover:border-primary/40 hover:bg-muted/60">
                  {previewUrl ? (
                    <div className="relative w-full">
                      <img alt="Apercu" className="aspect-square w-full object-cover" src={previewUrl} />
                      <Button
                        className="absolute right-3 top-3"
                        onClick={(event) => {
                          event.preventDefault()
                          setImageFile(null)
                        }}
                        size="icon"
                        type="button"
                        variant="secondary"
                      >
                        <X />
                      </Button>
                    </div>
                  ) : (
                    <div className="grid aspect-[16/12] w-full place-items-center p-6 text-center">
                      <div>
                        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-background text-primary ring-1 ring-border">
                          <Upload className="size-5" />
                        </div>
                        <div className="font-heading text-sm font-medium">Ajouter une image</div>
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          PNG · JPG · WEBP · GIF
                        </div>
                      </div>
                    </div>
                  )}
                  <Input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>
                <Textarea
                  className="min-h-28 resize-none font-heading text-base leading-relaxed"
                  placeholder="Que voulez-vous partager ?"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
                {mutation.error ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {mutation.error.message}
                  </div>
                ) : null}
                <Button type="submit" disabled={mutation.isPending || (!body.trim() && !imageFile)}>
                  <ImagePlus />
                  Publier
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Groups
// ─────────────────────────────────────────────────────────────

function GroupsPage({ companyId, employees }: { companyId: string; employees: EmployeeDTO[] }) {
  const client = useQueryClient()
  const groups = useQuery({ queryKey: ["groups", companyId], queryFn: () => getGroups(companyId) })
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const mutation = useMutation({
    mutationFn: () => createGroup(companyId, { name, description, memberEmployeeIds: [] }),
    onSuccess: () => {
      setName("")
      setDescription("")
      void client.invalidateQueries({ queryKey: ["groups", companyId] })
    },
  })

  return (
    <div className="editorial-enter grid gap-6">
      <PageOpener
        marker="07"
        eyebrow="Collectifs · Cercles de travail"
        title="Les groupes."
        description="Squads, communautes de pratique et collectifs internes au sein de l'entreprise."
        meta={
          <div className="grid gap-1 text-right">
            <span className="metric-figure-sm">{(groups.data ?? []).length}</span>
            <span className="eyebrow-tight">Groupes actifs</span>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="self-start border-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="gap-2">
            <span className="eyebrow">Nouveau groupe</span>
            <CardTitle className="font-heading text-xl">Creer un collectif</CardTitle>
            <CardDescription>{employees.length} employes mobilisables.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                mutation.mutate()
              }}
            >
              <div className="grid gap-1.5">
                <Label className="eyebrow-tight">Nom du groupe</Label>
                <Input placeholder="Squad backend" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="eyebrow-tight">Description</Label>
                <Textarea
                  className="min-h-24"
                  placeholder="Mission, perimetre, rituels..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                <Plus />
                Creer le groupe
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          {(groups.data ?? []).map((group, index) => (
            <div key={group.id} className="panel grid gap-3 border-l-2 border-l-primary/40 p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="section-marker text-xs text-muted-foreground tabular">
                  G·{String(index + 1).padStart(2, "0")}
                </span>
                <Badge variant="outline" className="rounded-md font-mono">
                  <MapPin className="size-3" /> {shortDate(group.createdAt)}
                </Badge>
              </div>
              <h3 className="font-heading text-lg font-medium leading-tight">{group.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {group.description ?? "Aucune description"}
              </p>
            </div>
          ))}
          {!groups.isLoading && (groups.data ?? []).length === 0 ? (
            <div className="hatch col-span-full grid place-items-center rounded-md py-12 text-xs text-muted-foreground">
              Aucun groupe — creez le premier collectif.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Gros admin
// ─────────────────────────────────────────────────────────────

function SuperAdminPage({
  currentUserName,
  currentUserEmail,
  onOpenCompany,
}: {
  currentUserName: string
  currentUserEmail: string
  onOpenCompany: (companyId: string, companyName?: string) => void
}) {
  const client = useQueryClient()
  const companies = useQuery({ queryKey: ["super-admin-companies"], queryFn: getSuperAdminCompanies })
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [timezone, setTimezone] = useState("Europe/Paris")
  const [adminCanReadConversations, setAdminCanReadConversations] = useState(false)
  const [ownerName, setOwnerName] = useState(currentUserName)
  const [ownerEmail, setOwnerEmail] = useState(currentUserEmail)
  const [ownerTitle, setOwnerTitle] = useState("Owner")
  const [ownerPassword, setOwnerPassword] = useState("Companinator123!")
  const [companyImportSummaries, setCompanyImportSummaries] = useState<Record<string, string>>({})

  const companyRows = companies.data ?? []
  const totals = companyRows.reduce(
    (acc, company) => ({
      employees: acc.employees + company.employeeCount,
      members: acc.members + company.membershipCount,
      conversations: acc.conversations + company.conversationCount,
      readable: acc.readable + (company.adminCanReadConversations ? 1 : 0),
    }),
    { employees: 0, members: 0, conversations: 0, readable: 0 },
  )

  const mutation = useMutation({
    mutationFn: () =>
      createSuperAdminCompany({
        name,
        slug: slug || undefined,
        timezone,
        adminCanReadConversations,
        ownerName: ownerName || undefined,
        ownerEmail: ownerEmail || undefined,
        ownerTitle,
        ownerPassword: ownerPassword || undefined,
      }),
    onSuccess: (company) => {
      void client.invalidateQueries({ queryKey: ["super-admin-companies"] })
      void client.invalidateQueries({ queryKey: ["me"] })
      setName("")
      setSlug("")
      setSlugEdited(false)
      setAdminCanReadConversations(false)
      onOpenCompany(company.id, company.name)
    },
  })
  const importMutation = useMutation({
    mutationFn: ({ companyId, file }: { companyId: string; file: File }) => importHierarchyCsv(companyId, file),
    onSuccess: (result, variables) => {
      setCompanyImportSummaries((current) => ({
        ...current,
        [variables.companyId]: `${result.created} crees · ${result.updated} mis a jour · ${result.linked} liens`,
      }))
      applyHierarchyImportCache(client, variables.companyId, result)
      void client.invalidateQueries({ queryKey: ["super-admin-companies"] })
      void client.invalidateQueries({ queryKey: ["hierarchy", variables.companyId] })
      void client.invalidateQueries({ queryKey: ["employees", variables.companyId] })
      void client.invalidateQueries({ queryKey: ["dashboard", variables.companyId] })
    },
  })

  return (
    <div className="editorial-enter grid gap-6">
      <PageOpener
        marker="09"
        eyebrow="Plateforme · Multi-tenant"
        title="Gros admin."
        description="Creation des tenants, owners et premiers profils entreprise."
        meta={
          <Badge variant="outline" className="rounded-md font-mono">
            <Globe2 className="size-3" /> System
          </Badge>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <AdminMetric label="Entreprises" value={companyRows.length} icon={Building2} />
        <AdminMetric label="Employes" value={totals.employees} icon={Users} />
        <AdminMetric label="Membres" value={totals.members} icon={Shield} />
        <AdminMetric label="Audit ouvert" value={totals.readable} icon={MessageSquare} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="self-start border-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="gap-2">
            <span className="eyebrow">Creation · Entreprise</span>
            <CardTitle className="font-heading text-xl">Nouveau tenant</CardTitle>
            <CardDescription>Entreprise, owner initial et politique de confidentialite.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                mutation.mutate()
              }}
            >
              <div className="grid gap-2">
                <Label className="eyebrow-tight" htmlFor="company-name">
                  Entreprise
                </Label>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(event) => {
                    const nextName = event.target.value
                    setName(nextName)
                    if (!slugEdited) {
                      setSlug(slugifyCompanyName(nextName))
                    }
                  }}
                  placeholder="Nova Industrie"
                  required
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="eyebrow-tight" htmlFor="company-slug">
                    Slug
                  </Label>
                  <Input
                    id="company-slug"
                    value={slug}
                    onChange={(event) => {
                      setSlugEdited(true)
                      setSlug(slugifyCompanyName(event.target.value))
                    }}
                    placeholder="nova-industrie"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="eyebrow-tight" htmlFor="company-timezone">
                    Timezone
                  </Label>
                  <Input
                    id="company-timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    required
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="eyebrow-tight" htmlFor="owner-name">
                    Owner
                  </Label>
                  <Input
                    id="owner-name"
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="eyebrow-tight" htmlFor="owner-email">
                    Email owner
                  </Label>
                  <Input
                    id="owner-email"
                    type="email"
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="eyebrow-tight" htmlFor="owner-title">
                    Poste owner
                  </Label>
                  <Input
                    id="owner-title"
                    value={ownerTitle}
                    onChange={(event) => setOwnerTitle(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="eyebrow-tight" htmlFor="owner-password">
                    Mot de passe temporaire
                  </Label>
                  <Input
                    id="owner-password"
                    type="password"
                    value={ownerPassword}
                    onChange={(event) => setOwnerPassword(event.target.value)}
                    minLength={8}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Lecture admin des conversations</p>
                  <p className="text-xs text-muted-foreground">Politique initiale du tenant.</p>
                </div>
                <Switch checked={adminCanReadConversations} onCheckedChange={setAdminCanReadConversations} />
              </div>

              {mutation.error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {mutation.error.message}
                </div>
              ) : null}

              <Button type="submit" disabled={mutation.isPending || !name || !slug}>
                <Plus />
                {mutation.isPending ? "Creation..." : "Creer l'entreprise"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className="eyebrow">Tenants · Registre</span>
            <span className="toc-leader" aria-hidden />
            <span className="section-marker text-xs text-muted-foreground tabular">
              {String(companyRows.length).padStart(2, "0")} entreprises
            </span>
          </div>
          {importMutation.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {importMutation.error.message}
            </div>
          ) : null}
          <div className="grid gap-3">
            {companyRows.map((company) => (
              <SystemCompanyCard
                key={company.id}
                company={company}
                importing={importMutation.isPending && importMutation.variables?.companyId === company.id}
                importSummary={companyImportSummaries[company.id] ?? null}
                onImportHierarchy={(file) => importMutation.mutate({ companyId: company.id, file })}
                onOpenCompany={onOpenCompany}
              />
            ))}
            {!companies.isLoading && companyRows.length === 0 ? (
              <div className="hatch grid place-items-center rounded-xl py-12 text-xs text-muted-foreground">
                Aucune entreprise creee.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof LayoutDashboard
}) {
  return (
    <div className="panel flex items-center justify-between gap-4 p-4">
      <div className="grid gap-1">
        <span className="eyebrow-tight">{label}</span>
        <span className="font-heading text-2xl font-medium tabular">{String(value).padStart(2, "0")}</span>
      </div>
      <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
    </div>
  )
}

function SystemCompanyCard({
  company,
  importing,
  importSummary,
  onImportHierarchy,
  onOpenCompany,
}: {
  company: SystemCompanyDTO
  importing: boolean
  importSummary: string | null
  onImportHierarchy: (file: File) => void
  onOpenCompany: (companyId: string, companyName?: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="panel grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-xl font-medium">{company.name}</h3>
              <Badge variant="outline" className="rounded-md font-mono">
                {company.slug}
              </Badge>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Creee {shortDate(company.createdAt)} · {company.timezone}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) {
                onImportHierarchy(file)
              }
            }}
          />
          <Button variant="outline" size="sm" disabled={importing} onClick={() => inputRef.current?.click()}>
            <Upload />
            {importing ? "Import..." : "CSV"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenCompany(company.id, company.name)}>
            <ArrowUpRight />
            Ouvrir
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border bg-muted/20 px-3 py-2">
          <span className="eyebrow-tight">Employes</span>
          <p className="font-heading text-lg tabular">{company.employeeCount}</p>
        </div>
        <div className="rounded-xl border bg-muted/20 px-3 py-2">
          <span className="eyebrow-tight">Membres</span>
          <p className="font-heading text-lg tabular">{company.membershipCount}</p>
        </div>
        <div className="rounded-xl border bg-muted/20 px-3 py-2">
          <span className="eyebrow-tight">Conversations</span>
          <p className="font-heading text-lg tabular">{company.conversationCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={company.adminCanReadConversations ? "default" : "outline"} className="rounded-md font-mono">
          {company.adminCanReadConversations ? "Audit complet" : "Mode prive"}
        </Badge>
        {company.currentUserRole ? (
          <Badge variant="outline" className="rounded-md font-mono">
            {company.currentUserRole}
          </Badge>
        ) : null}
        {company.owners.map((owner) => (
          <Badge key={owner.id} variant="outline" className="rounded-md font-mono">
            {owner.email}
          </Badge>
        ))}
        {importSummary ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{importSummary}</span>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Admin
// ─────────────────────────────────────────────────────────────

function AdminPage({
  companyId,
  adminCanRead,
  isAdmin,
}: {
  companyId: string
  adminCanRead: boolean
  isAdmin: boolean
}) {
  const client = useQueryClient()
  const admin = useQuery({
    queryKey: ["admin-conversations", companyId],
    queryFn: () => getAdminConversations(companyId),
    enabled: isAdmin,
  })
  const mutation = useMutation({
    mutationFn: (checked: boolean) => updateCompanySettings(companyId, { adminCanReadConversations: checked }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["me"] })
      void client.invalidateQueries({ queryKey: ["admin-conversations", companyId] })
    },
  })

  if (!isAdmin) {
    return (
      <div className="editorial-enter grid gap-6">
        <PageOpener
          marker="08"
          eyebrow="Gouvernance · Lecture restreinte"
          title="Acces reserve."
          description="Cette section est reservee aux owners et admins de l'entreprise."
        />
        <div className="panel grid place-items-center gap-3 p-12 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="size-6" />
          </div>
          <p className="font-heading text-lg">Permissions insuffisantes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="editorial-enter grid gap-6">
      <PageOpener
        marker="08"
        eyebrow="Gouvernance · Audit & confidentialite"
        title="Administration."
        description="Politique de lecture des conversations, audit des canaux et droits d'admin."
        meta={
          <Badge variant="outline" className="rounded-md font-mono">
            <Shield className="size-3" /> Owner / Admin
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="self-start border-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="gap-2">
            <span className="eyebrow">Politique · Lecture admin</span>
            <CardTitle className="font-heading text-xl">Confidentialite</CardTitle>
            <CardDescription>
              Si l'option est desactivee, seules les metadonnees sont visibles cote admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Lecture des messages</p>
                <p className="text-xs text-muted-foreground">Permet a l'admin de lire le contenu des messages.</p>
              </div>
              <Switch checked={adminCanRead} onCheckedChange={(checked) => mutation.mutate(checked)} />
            </div>
            <Separator />
            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="eyebrow-tight">Mode actuel</span>
                <Badge variant="outline" className="rounded-md font-mono">
                  {admin.data?.mode ?? "..."}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="eyebrow-tight">Canaux audites</span>
                <span className="font-mono text-foreground tabular">
                  {String(admin.data?.conversations.length ?? 0).padStart(2, "0")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className="eyebrow">Audit · Conversations</span>
            <span className="toc-leader" aria-hidden />
            <span className="section-marker text-xs text-muted-foreground tabular">
              {String(admin.data?.conversations.length ?? 0).padStart(2, "0")} canaux
            </span>
          </div>
          <div className="panel divide-y">
            {(admin.data?.conversations ?? []).map((conversation, index) => (
              <div key={conversation.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4">
                <span className="section-marker text-xs text-muted-foreground tabular">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="grid gap-0.5">
                  <strong className="font-heading text-sm font-medium">
                    {conversation.title ?? conversation.type}
                  </strong>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {shortDate(conversation.lastMessageAt)}
                  </span>
                </div>
                <Badge variant="outline" className="rounded-md font-mono">
                  <Users className="size-3" /> {conversation.participantEmployeeIds.length}
                </Badge>
              </div>
            ))}
            {!admin.isLoading && (admin.data?.conversations ?? []).length === 0 ? (
              <div className="hatch grid place-items-center rounded-md py-12 text-xs text-muted-foreground">
                Aucune conversation a auditer.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Employee sheet (right drawer)
// ─────────────────────────────────────────────────────────────

function EmployeeSheet({
  companyId,
  employee,
  meEmployeeId,
  onMessageEmployee,
  onOpenChange,
}: {
  companyId: string
  employee: EmployeeDTO | null
  meEmployeeId: string | null
  onMessageEmployee: (employee: EmployeeDTO) => Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  const client = useQueryClient()
  const [title, setTitle] = useState("")
  const [startsAt, setStartsAt] = useState(localDateTime(24))
  const [endsAt, setEndsAt] = useState(localDateTime(25))
  const [messageError, setMessageError] = useState<string | null>(null)
  const [openingMessage, setOpeningMessage] = useState(false)
  const events = useQuery({
    queryKey: ["employee-events", companyId, employee?.id],
    queryFn: () => getEmployeeEvents(companyId, employee!.id),
    enabled: Boolean(employee),
  })
  const mutation = useMutation({
    mutationFn: () =>
      createEvent(companyId, employee!.id, {
        title,
        type: "meeting",
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    onSuccess: () => {
      setTitle("")
      void client.invalidateQueries({ queryKey: ["employee-events", companyId, employee?.id] })
      void client.invalidateQueries({ queryKey: ["dashboard", companyId] })
    },
  })

  const tone = departmentTone(employee?.department)
  const isCurrentUser = Boolean(employee && meEmployeeId === employee.id)

  useEffect(() => {
    setMessageError(null)
    setOpeningMessage(false)
  }, [employee?.id])

  return (
    <Sheet open={Boolean(employee)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {employee ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "grid size-14 shrink-0 place-items-center rounded-md text-base font-semibold ring-1",
                    tone.avatar,
                  )}
                >
                  {initials(employee.name)}
                </div>
                <div className="grid gap-1">
                  <span className="eyebrow">Profil · {tone.label}</span>
                  <SheetTitle className="font-heading text-2xl">{employee.name}</SheetTitle>
                  <SheetDescription>{employee.title}</SheetDescription>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-primary">
                    @{employeeHandle(employee)}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="grid gap-5 p-4">
              <div className="panel grid gap-3 p-4">
                <Button
                  className="rounded-xl"
                  disabled={isCurrentUser || openingMessage}
                  onClick={async () => {
                    setMessageError(null)
                    setOpeningMessage(true)
                    try {
                      await onMessageEmployee(employee)
                    } catch (error) {
                      setMessageError(error instanceof Error ? error.message : "Impossible d'ouvrir la conversation")
                    } finally {
                      setOpeningMessage(false)
                    }
                  }}
                  type="button"
                >
                  <MessageSquare />
                  {isCurrentUser ? "Votre profil" : openingMessage ? "Ouverture..." : "Envoyer un message"}
                </Button>
                {messageError ? <p className="text-xs text-destructive">{messageError}</p> : null}
              </div>

              <div className="panel grid gap-3 p-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="eyebrow-tight">Description de poste</span>
                </div>
                <p className="text-sm leading-relaxed">{employee.jobDescription}</p>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center gap-3">
                  <span className="eyebrow">Agenda</span>
                  <span className="toc-leader" aria-hidden />
                  <span className="section-marker text-xs text-muted-foreground tabular">
                    {String((events.data ?? []).length).padStart(2, "0")} evenements
                  </span>
                </div>
                <div className="grid gap-2">
                  {(events.data ?? []).map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                  {!events.isLoading && (events.data ?? []).length === 0 ? (
                    <div className="hatch grid place-items-center rounded-md py-8 text-xs text-muted-foreground">
                      Aucun evenement planifie
                    </div>
                  ) : null}
                </div>
              </div>

              <form
                className="panel grid gap-3 p-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  mutation.mutate()
                }}
              >
                <span className="eyebrow">Ajouter un evenement</span>
                <Input
                  placeholder="Titre du creneau"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="eyebrow-tight">Debut</Label>
                    <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="eyebrow-tight">Fin</Label>
                    <Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
                  </div>
                </div>
                <Button type="submit" disabled={mutation.isPending}>
                  <CalendarPlus />
                  Planifier
                </Button>
              </form>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function EventRow({ event }: { event: EmployeeEventDTO }) {
  return (
    <div className="grid gap-1 rounded-md border bg-card px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <strong className="font-heading text-sm font-medium">{event.title}</strong>
        <Badge variant="outline" className="rounded-md font-mono">
          {event.type}
        </Badge>
      </div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {shortDate(event.startsAt)} — {shortDate(event.endsAt)}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Shell — editorial sidebar + header
// ─────────────────────────────────────────────────────────────

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function AppShell() {
  const client = useQueryClient()
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false })
  const [section, setSection] = useState<Section>("dashboard")
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDTO | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | null>(null)
  const isSystemAdmin = Boolean(me.data?.isSystemAdmin)
  const companyId = selectedCompanyId ?? me.data?.activeCompanyId ?? null
  const membership = me.data?.memberships.find((item) => item.companyId === companyId) ?? null
  const hasWorkspace = Boolean(companyId && (membership || isSystemAdmin))
  const isSystemCompanyContext = Boolean(companyId && isSystemAdmin && !membership)
  const isAdmin = membership?.role === "owner" || membership?.role === "admin"
  const visibleSections = useMemo(
    () =>
      sections.filter((item) => {
        if (item.id === "superAdmin") {
          return isSystemAdmin
        }
        if (!hasWorkspace) {
          return false
        }
        if (isSystemCompanyContext) {
          return item.id === "dashboard" || item.id === "hierarchy" || item.id === "employees"
        }
        return true
      }),
    [hasWorkspace, isSystemAdmin, isSystemCompanyContext],
  )
  const visibleNavGrouped = useMemo(
    () =>
      (["workspace", "community", "governance"] as NavGroup[]).map((group) => ({
        id: group,
        label: navGroupLabels[group],
        items: visibleSections.filter((item) => item.group === group),
      })),
    [visibleSections],
  )
  const employeesQuery = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => getEmployees(companyId!),
    enabled: Boolean(companyId && (membership || isSystemAdmin)),
  })
  const employees = employeesQuery.data ?? []
  const conversationsQuery = useQuery({
    queryKey: ["conversations", companyId],
    queryFn: () => getConversations(companyId!),
    enabled: Boolean(companyId && membership),
  })
  const postsQuery = useQuery({
    queryKey: ["posts", companyId],
    queryFn: () => getPosts(companyId!),
    enabled: Boolean(companyId && membership),
  })
  const now = useClock()

  useEffect(() => {
    if (!isSystemAdmin && section === "superAdmin") {
      setSection("dashboard")
    }
    if (isSystemAdmin && !hasWorkspace && section !== "superAdmin") {
      setSection("superAdmin")
    }
  }, [hasWorkspace, isSystemAdmin, section])

  async function openMessageWithEmployee(employee: EmployeeDTO) {
    if (!companyId) {
      throw new Error("Entreprise introuvable")
    }
    if (isSystemCompanyContext) {
      throw new Error("Messagerie indisponible en mode super admin")
    }

    const meEmployeeId = me.data?.employee?.id
    if (!meEmployeeId || meEmployeeId === employee.id) {
      return
    }

    const existing = (conversationsQuery.data ?? []).find((conversation) => {
      const participants = conversation.participantEmployeeIds
      return (
        conversation.type === "direct" &&
        participants.length === 2 &&
        participants.includes(meEmployeeId) &&
        participants.includes(employee.id)
      )
    })

    const conversation =
      existing ??
      (await createConversation(companyId, {
        type: "direct",
        participantEmployeeIds: [employee.id],
      }))

    if (!existing) {
      client.setQueryData<ConversationDTO[]>(["conversations", companyId], (current = []) => [conversation, ...current])
      void client.invalidateQueries({ queryKey: ["conversations", companyId] })
    }

    setSelectedConversationId(conversation.id)
    setSelectedEmployee(null)
    setSection("messages")
  }

  const clearSelectedConversation = useCallback(() => {
    setSelectedConversationId(null)
  }, [])

  const openCompany = useCallback((companyIdToOpen: string, companyNameToOpen?: string) => {
    setSelectedCompanyId(companyIdToOpen)
    setSelectedCompanyName(companyNameToOpen ?? null)
    setSection("hierarchy")
  }, [])

  if (me.isLoading) {
    return (
      <main className="editorial-shell grid min-h-svh place-items-center text-sm text-muted-foreground">
        <div className="grid gap-2 text-center">
          <span className="eyebrow">Chargement</span>
          <p className="font-heading text-2xl">Companinator</p>
        </div>
      </main>
    )
  }

  if (me.error) {
    return <LoginScreen onSignedIn={() => void client.invalidateQueries({ queryKey: ["me"] })} />
  }

  if (!hasWorkspace && !isSystemAdmin) {
    return (
      <main className="editorial-shell grid min-h-svh place-items-center">
        <div className="panel grid max-w-md gap-2 p-8 text-center">
          <span className="eyebrow">Workspace</span>
          <p className="font-heading text-2xl">Aucune entreprise associee.</p>
        </div>
      </main>
    )
  }

  const activeSection = sectionCopy[!hasWorkspace && isSystemAdmin ? "superAdmin" : section]
  const activeCompanyName = membership?.company.name ?? selectedCompanyName ?? "Plateforme"
  const activeRole = membership?.role ?? (companyId && isSystemAdmin ? "super admin" : "system")

  return (
    <div className="editorial-shell relative min-h-svh">
      {/* Sidebar — editorial table of contents */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r bg-card/95 backdrop-blur-sm lg:flex">
        {/* Logo block */}
        <div className="border-b px-6 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <GitBranch className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="eyebrow-tight">{format(now, "EEEE dd LLL")}</p>
              <h1 className="font-heading text-xl font-medium tracking-tight">Companinator</h1>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="grid gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="eyebrow-tight">Workspace</span>
              <span className="line-clamp-1 font-medium">{activeCompanyName}</span>
            </div>
            <div className="grid gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="eyebrow-tight">Role</span>
              <span className="font-mono uppercase tracking-wider">{activeRole}</span>
            </div>
          </div>
        </div>

        {/* TOC navigation */}
        <div className="editorial-scroll flex-1 overflow-y-auto px-3 py-5">
          {visibleNavGrouped.map((group) => (
            <div key={group.id} className="mb-6">
              <div className="mb-2 flex items-center gap-2 px-3">
                <span className="eyebrow">{group.label}</span>
                <span className="toc-leader" aria-hidden />
                <span className="font-mono text-[10px] tracking-wider text-muted-foreground tabular">
                  {String(group.items.length).padStart(2, "0")}
                </span>
              </div>
              <nav className="grid gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = section === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      data-active={active}
                      className={cn(
                        "nav-indicator group/nav relative flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                        active
                          ? "bg-muted text-foreground"
                          : "text-foreground/80 hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "section-marker w-6 shrink-0 text-xs tabular",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {item.number}
                      </span>
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="flex-1 truncate font-medium">{item.label}</span>
                      {active ? <ChevronRight className="size-3.5 text-primary" /> : null}
                    </button>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer block */}
        <div className="border-t bg-muted/20 px-6 py-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="eyebrow-tight">Utilisateur</span>
              <Badge variant="outline" className="rounded-md font-mono">
                <Sun className="size-3" /> Online
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {initials(me.data?.user.name ?? "??")}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium">{me.data?.user.name}</p>
                <p className="line-clamp-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {me.data?.user.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => {
                void signOut().finally(() => client.clear())
              }}
            >
              <Lock /> Se deconnecter
            </Button>
          </div>
        </div>
      </aside>

      <main className="relative z-10 lg:pl-72">
        {/* Editorial header */}
        <header className="sticky top-0 z-10 border-b bg-card/85 backdrop-blur">
          <div className="px-6 py-5 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="eyebrow">{activeSection.eyebrow}</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {activeCompanyName} · {activeRole}
                  </span>
                </div>
                <h2 className="editorial-title text-3xl md:text-[2.25rem]">
                  {activeSection.title}<span className="text-primary">.</span>
                </h2>
                <p className="max-w-2xl text-sm text-muted-foreground">{activeSection.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden grid-cols-3 gap-4 border-r pr-4 text-right md:grid">
                  <div className="grid gap-0.5">
                    <span className="eyebrow-tight">Profils</span>
                    <span className="font-heading text-base font-medium tabular">{employees.length}</span>
                  </div>
                  <div className="grid gap-0.5">
                    <span className="eyebrow-tight">Threads</span>
                    <span className="font-heading text-base font-medium tabular">
                      {(conversationsQuery.data ?? []).length}
                    </span>
                  </div>
                  <div className="grid gap-0.5">
                    <span className="eyebrow-tight">Posts</span>
                    <span className="font-heading text-base font-medium tabular">{(postsQuery.data ?? []).length}</span>
                  </div>
                </div>
                <div className="grid gap-0.5 text-right">
                  <span className="eyebrow-tight">Heure locale</span>
                  <span className="workspace-time text-base">{format(now, "HH:mm")}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile section switcher */}
        <div className="border-b bg-card px-4 py-3 lg:hidden">
          <ScrollArea className="editorial-scroll">
            <div className="flex gap-1.5 pb-2">
              {visibleSections.map((item) => (
                <Button
                  key={item.id}
                  size="xs"
                  variant={section === item.id ? "secondary" : "outline"}
                  onClick={() => setSection(item.id)}
                >
                  <span className="font-mono text-[10px] opacity-60">{item.number}</span>
                  {item.label}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div
          className={cn(
            "px-4 py-6 lg:px-10 lg:py-8",
            section === "hierarchy" && "px-3 py-3 lg:px-5 lg:py-4",
            section === "assistant" && "h-[calc(100svh-8.5rem)] overflow-hidden px-4 py-3 lg:h-[calc(100svh-6.5rem)] lg:px-8 lg:py-4",
          )}
        >
          {section === "dashboard" && companyId && hasWorkspace ? (
            <DashboardPage
              companyId={companyId}
              employees={employees}
              posts={postsQuery.data ?? []}
              conversations={conversationsQuery.data ?? []}
              companyName={activeCompanyName}
            />
          ) : null}
          {section === "hierarchy" && companyId ? (
            <HierarchyPage
              companyId={companyId}
              canImportHierarchy={isAdmin || isSystemAdmin}
              onSelectEmployee={setSelectedEmployee}
            />
          ) : null}
          {section === "employees" && companyId ? (
            <EmployeesPage companyId={companyId} employees={employees} onSelectEmployee={setSelectedEmployee} />
          ) : null}
          {section === "assistant" && companyId ? (
            <AssistantPage companyId={companyId} onSelectEmployee={setSelectedEmployee} />
          ) : null}
          {section === "messages" && companyId ? (
            <MessagesPage
              companyId={companyId}
              employees={employees}
              meEmployeeId={me.data?.employee?.id ?? null}
              selectedConversationId={selectedConversationId}
              onSelectedConversationOpened={clearSelectedConversation}
            />
          ) : null}
          {section === "community" && companyId ? <CommunityPage companyId={companyId} employees={employees} /> : null}
          {section === "groups" && companyId ? <GroupsPage companyId={companyId} employees={employees} /> : null}
          {section === "admin" && companyId && membership ? (
            <AdminPage
              companyId={companyId}
              adminCanRead={membership.company.adminCanReadConversations}
              isAdmin={isAdmin}
            />
          ) : null}
          {section === "superAdmin" && isSystemAdmin ? (
            <SuperAdminPage
              currentUserName={me.data?.user.name ?? ""}
              currentUserEmail={me.data?.user.email ?? ""}
              onOpenCompany={openCompany}
            />
          ) : null}
        </div>

        {section !== "hierarchy" && section !== "assistant" ? (
        <footer className="border-t bg-card/60 px-4 py-4 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <Sigma className="size-3.5" />
              <span className="font-mono uppercase tracking-wider">Companinator · interne</span>
            </div>
            <div className="flex items-center gap-3 font-mono uppercase tracking-wider">
              <span>v0.2.1</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{format(now, "yyyy-MM-dd")}</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{format(now, "HH:mm")}</span>
            </div>
          </div>
        </footer>
        ) : null}
      </main>

      {companyId ? (
        <EmployeeSheet
          companyId={companyId}
          employee={selectedEmployee}
          meEmployeeId={isSystemCompanyContext ? null : me.data?.employee?.id ?? null}
          onMessageEmployee={openMessageWithEmployee}
          onOpenChange={(open) => !open && setSelectedEmployee(null)}
        />
      ) : null}
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  )
}
