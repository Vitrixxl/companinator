import { useEffect, useMemo, useState } from "react"
import dagre from "dagre"
import { format } from "date-fns"
import {
  Bot,
  Bookmark,
  Building2,
  CalendarPlus,
  CalendarClock,
  ChevronRight,
  CircleDot,
  GitBranch,
  Heart,
  ImagePlus,
  LayoutDashboard,
  Lock,
  MessageSquare,
  MessageCircle,
  MoreHorizontal,
  Network,
  Plus,
  Search,
  Send,
  Shield,
  Sparkles,
  Upload,
  Users,
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
  askAssistant,
  assetUrl,
  createEmployee,
  createEvent,
  createGroup,
  createPost,
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
  sendMessage,
  signIn,
  signOut,
  updateCompanySettings,
} from "./lib/api"

const queryClient = new QueryClient()

type Section = "dashboard" | "hierarchy" | "employees" | "assistant" | "messages" | "community" | "groups" | "admin"

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Pilotage", icon: LayoutDashboard },
  { id: "hierarchy", label: "Hierarchie", icon: GitBranch },
  { id: "employees", label: "Employes", icon: Users },
  { id: "assistant", label: "Assistant", icon: Search },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "community", label: "Communaute", icon: CircleDot },
  { id: "groups", label: "Groupes", icon: Building2 },
  { id: "admin", label: "Admin", icon: Shield },
]

const sectionCopy: Record<Section, { title: string; subtitle: string }> = {
  dashboard: { title: "Pilotage", subtitle: "Synthese temps reel de l'organisation" },
  hierarchy: { title: "Hierarchie", subtitle: "Structure manageriale et responsabilites" },
  employees: { title: "Employes", subtitle: "Annuaire, postes et descriptions vectorisees" },
  assistant: { title: "Assistant", subtitle: "Recherche de profils et disponibilites" },
  messages: { title: "Messages", subtitle: "Conversations internes par equipe" },
  community: { title: "Communaute", subtitle: "Posts et annonces d'entreprise" },
  groups: { title: "Groupes", subtitle: "Collectifs, squads et cercles de travail" },
  admin: { title: "Admin", subtitle: "Gouvernance et droits de lecture" },
}

type DepartmentTone = {
  label: string
  bar: string
  chip: string
  avatar: string
  soft: string
}

function departmentTone(department: string | null | undefined): DepartmentTone {
  const normalized = (department ?? "Equipe").toLowerCase()

  if (normalized.includes("engineering") || normalized.includes("data")) {
    return {
      label: department ?? "Engineering",
      bar: "bg-emerald-500",
      chip: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
      avatar: "bg-emerald-100 text-emerald-950 ring-emerald-200 dark:bg-emerald-900 dark:text-emerald-50 dark:ring-emerald-700",
      soft: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    }
  }

  if (normalized.includes("produit") || normalized.includes("product")) {
    return {
      label: department ?? "Produit",
      bar: "bg-blue-500",
      chip: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100",
      avatar: "bg-blue-100 text-blue-950 ring-blue-200 dark:bg-blue-900 dark:text-blue-50 dark:ring-blue-700",
      soft: "bg-blue-500/10 text-blue-900 dark:text-blue-100",
    }
  }

  if (normalized.includes("sales") || normalized.includes("success") || normalized.includes("support")) {
    return {
      label: department ?? "Sales",
      bar: "bg-amber-500",
      chip: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
      avatar: "bg-amber-100 text-amber-950 ring-amber-200 dark:bg-amber-900 dark:text-amber-50 dark:ring-amber-700",
      soft: "bg-amber-500/10 text-amber-950 dark:text-amber-100",
    }
  }

  if (normalized.includes("people") || normalized.includes("rh")) {
    return {
      label: department ?? "People",
      bar: "bg-rose-500",
      chip: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100",
      avatar: "bg-rose-100 text-rose-950 ring-rose-200 dark:bg-rose-900 dark:text-rose-50 dark:ring-rose-700",
      soft: "bg-rose-500/10 text-rose-950 dark:text-rose-100",
    }
  }

  if (normalized.includes("finance") || normalized.includes("direction")) {
    return {
      label: department ?? "Direction",
      bar: "bg-slate-500",
      chip: "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100",
      avatar: "bg-slate-100 text-slate-950 ring-slate-200 dark:bg-slate-800 dark:text-slate-50 dark:ring-slate-600",
      soft: "bg-slate-500/10 text-slate-900 dark:text-slate-100",
    }
  }

  return {
    label: department ?? "Equipe",
    bar: "bg-cyan-500",
    chip: "border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100",
    avatar: "bg-cyan-100 text-cyan-950 ring-cyan-200 dark:bg-cyan-900 dark:text-cyan-50 dark:ring-cyan-700",
    soft: "bg-cyan-500/10 text-cyan-950 dark:text-cyan-100",
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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function readableDate(value: string | null | undefined) {
  if (!value) {
    return "Aucune date"
  }

  return format(new Date(value), "dd/MM/yyyy HH:mm")
}

function localDateTime(offsetHours: number) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000)
  date.setMinutes(0, 0, 0)
  return date.toISOString().slice(0, 16)
}

function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("admin@acme.local")
  const [password, setPassword] = useState("Companinator123!")
  const mutation = useMutation({
    mutationFn: () => signIn(email, password),
    onSuccess: onSignedIn,
  })

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Companinator</CardTitle>
          <CardDescription>Connexion a l'espace entreprise.</CardDescription>
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
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}
            <Button type="submit" disabled={mutation.isPending}>
              <Lock />
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  loading,
}: {
  label: string
  value: number
  detail: string
  icon: typeof Users
  tone: string
  loading: boolean
}) {
  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/70" size="sm">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-3xl tracking-normal">{loading ? "..." : value}</CardTitle>
          </div>
          <div className={cn("grid size-10 place-items-center rounded-lg", tone)}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </CardHeader>
    </Card>
  )
}

function DashboardPage({ companyId }: { companyId: string }) {
  const dashboard = useQuery({ queryKey: ["dashboard", companyId], queryFn: () => getDashboard(companyId) })
  const metrics = [
    {
      label: "Employes",
      value: dashboard.data?.employees ?? 0,
      detail: "Profils actifs",
      icon: Users,
      tone: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    },
    {
      label: "Evenements",
      value: dashboard.data?.events ?? 0,
      detail: "Creneaux suivis",
      icon: CalendarClock,
      tone: "bg-blue-500/10 text-blue-900 dark:text-blue-100",
    },
    {
      label: "Conversations",
      value: dashboard.data?.conversations ?? 0,
      detail: "Canaux actifs",
      icon: MessageSquare,
      tone: "bg-amber-500/10 text-amber-950 dark:text-amber-100",
    },
    {
      label: "Posts",
      value: dashboard.data?.posts ?? 0,
      detail: "Annonces internes",
      icon: CircleDot,
      tone: "bg-rose-500/10 text-rose-950 dark:text-rose-100",
    },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} loading={dashboard.isLoading} {...metric} />
      ))}
      <Card className="border-0 shadow-sm ring-1 ring-border/70 lg:col-span-4">
        <CardHeader className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <CardTitle>Vue operationnelle</CardTitle>
            <CardDescription>Organisation, disponibilites et echanges internes.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">B2B SaaS</Badge>
            <Badge variant="outline">Postgres + pgvector</Badge>
            <Badge variant="outline">Ollama ready</Badge>
          </div>
        </CardHeader>
      </Card>
    </div>
  )
}

type EmployeeNodeData = {
  employee: EmployeeDTO
  managerName: string | null
  reportCount: number
}

type EmployeeFlowNode = Node<EmployeeNodeData, "employee">

const employeeNodeWidth = 292
const employeeNodeHeight = 134

function EmployeeNode({ data, selected }: NodeProps<EmployeeFlowNode>) {
  const tone = departmentTone(data.employee.department)

  return (
    <div
      className={cn(
        "group relative w-[292px] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm ring-1 ring-foreground/5 transition duration-150",
        "hover:-translate-y-0.5 hover:shadow-md",
        selected && "border-primary/50 shadow-md ring-2 ring-primary/25",
      )}
    >
      <Handle className="opacity-0" isConnectable={false} position={Position.Top} type="target" />
      <div className={cn("h-1.5", tone.bar)} />
      <div className="grid gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className={cn("grid size-11 shrink-0 place-items-center rounded-lg text-sm font-semibold ring-1", tone.avatar)}>
            {initials(data.employee.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <strong className="truncate text-sm leading-5">{data.employee.name}</strong>
              {data.reportCount > 0 ? (
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tone.soft)}>
                  {data.reportCount}
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{data.employee.title}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn("max-w-[152px] truncate rounded-md", tone.chip)}>
            {tone.label}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            {data.managerName ? `N+1 ${data.managerName}` : "Direction"}
          </span>
        </div>
      </div>
      <Handle className="opacity-0" isConnectable={false} position={Position.Bottom} type="source" />
    </div>
  )
}

const nodeTypes = {
  employee: EmployeeNode,
}

function buildFlow(nodes: EmployeeDTO[], edges: Edge[]): EmployeeFlowNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: "TB", nodesep: 64, ranksep: 96 })
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
  onSelectEmployee,
}: {
  companyId: string
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const hierarchy = useQuery({ queryKey: ["hierarchy", companyId], queryFn: () => getHierarchy(companyId) })
  const flowEdges: Edge[] = useMemo(
    () =>
      (hierarchy.data?.edges ?? []).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: false,
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "oklch(0.709 0.01 56.259)",
          width: 16,
          height: 16,
        },
        style: {
          stroke: "oklch(0.709 0.01 56.259)",
          strokeWidth: 1.6,
        },
      })),
    [hierarchy.data?.edges],
  )
  const hierarchyEmployees = useMemo(() => (hierarchy.data?.nodes ?? []).map((node) => node.employee), [hierarchy.data?.nodes])
  const flowNodes = useMemo(
    () => buildFlow(hierarchyEmployees, flowEdges),
    [hierarchyEmployees, flowEdges],
  )
  const departments = new Set(hierarchyEmployees.map((employee) => employee.department ?? "Equipe"))
  const managers = new Set(hierarchyEmployees.filter((employee) => flowEdges.some((edge) => edge.source === employee.id)).map((employee) => employee.id))

  return (
    <Card className="flex h-[calc(100svh-8rem)] min-h-[720px] flex-col overflow-hidden border-0 shadow-sm ring-1 ring-border/70">
      <CardHeader className="shrink-0 border-b bg-background/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Network className="size-5" />
              </div>
              <CardTitle>Organigramme</CardTitle>
            </div>
            <CardDescription>Vue manageriale, postes et equipes rattachees.</CardDescription>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="font-medium">{hierarchyEmployees.length}</div>
              <div className="text-xs text-muted-foreground">Employes</div>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="font-medium">{departments.size}</div>
              <div className="text-xs text-muted-foreground">Equipes</div>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="font-medium">{managers.size}</div>
              <div className="text-xs text-muted-foreground">Managers</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
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
          <Background color="oklch(0.923 0.003 48.717)" gap={28} size={1} />
          <Controls className="org-flow-controls" showInteractive={false} />
        </ReactFlow>
      </CardContent>
    </Card>
  )
}

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

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Employes</CardTitle>
          <CardDescription>{employees.length} profils actifs dans l'entreprise.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {employees.map((employee) => (
            <button
              key={employee.id}
              className="grid gap-1 rounded-md border bg-background p-3 text-left transition hover:bg-muted/60"
              onClick={() => onSelectEmployee(employee)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <strong>{employee.name}</strong>
                <Badge variant="outline">{employee.department ?? "Equipe"}</Badge>
              </div>
              <span className="text-sm text-muted-foreground">{employee.title}</span>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Nouvel employe</CardTitle>
          <CardDescription>La description de poste servira a alimenter l'embedding.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <Input placeholder="Nom" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input placeholder="Poste" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <Input
              placeholder="Departement"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
            />
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={managerId}
              onChange={(event) => setManagerId(event.target.value)}
            >
              <option value="">Aucun superieur</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <Textarea
              placeholder="Description de poste"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              required
            />
            {mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}
            <Button type="submit" disabled={mutation.isPending}>
              <Plus />
              Ajouter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function AssistantAnswer({
  answer,
  onSelectEmployee,
}: {
  answer: AssistantResponseDTO
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const mentions = new Map(
    answer.candidates.map((candidate) => [`@${candidate.handle || employeeHandle(candidate.employee)}`.toLowerCase(), candidate.employee]),
  )
  const parts = answer.answer.split(/(@[a-z0-9_]+)/gi)

  return (
    <p className="rounded-lg border bg-muted/70 p-4 text-sm leading-relaxed">
      {parts.map((part, index) => {
        const employee = mentions.get(part.toLowerCase())
        if (!employee) {
          return <span key={`${part}-${index}`}>{part}</span>
        }

        return (
          <button
            key={`${part}-${employee.id}-${index}`}
            className="mx-0.5 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => onSelectEmployee(employee)}
            type="button"
          >
            {part}
          </button>
        )
      })}
    </p>
  )
}

function AssistantPage({
  companyId,
  onSelectEmployee,
}: {
  companyId: string
  onSelectEmployee: (employee: EmployeeDTO) => void
}) {
  const [query, setQuery] = useState("Je voudrais faire un point avec un dev demain")
  const [answer, setAnswer] = useState<AssistantResponseDTO | null>(null)
  const mutation = useMutation({
    mutationFn: () => askAssistant(companyId, query),
    onSuccess: setAnswer,
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card className="border-0 shadow-sm ring-1 ring-border/70">
        <CardHeader className="gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div>
              <CardTitle>Assistant IA locale</CardTitle>
              <CardDescription>Ollama, embeddings locaux et recherche vectorielle.</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">LLM local</Badge>
            <Badge variant="outline">embeddinggemma</Badge>
            <Badge variant="outline">pgvector</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <Textarea value={query} onChange={(event) => setQuery(event.target.value)} />
            {mutation.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {mutation.error.message}
              </div>
            ) : null}
            <Button type="submit" disabled={mutation.isPending}>
              <Sparkles />
              {mutation.isPending ? "Analyse en cours" : "Analyser avec l'IA"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm ring-1 ring-border/70">
        <CardHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Resultats</CardTitle>
              <CardDescription>
                {answer?.interpretedRole ?? "Recherche semantique"} / {answer?.interpretedDate ?? "date non precisee"}
              </CardDescription>
            </div>
            {answer ? (
              <Badge variant={answer.ollamaAvailable ? "default" : "destructive"}>
                {answer.ollamaAvailable ? "IA active" : "IA inactive"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {answer ? (
            <>
              <AssistantAnswer answer={answer} onSelectEmployee={onSelectEmployee} />
              <div className="grid gap-3 md:grid-cols-2">
                {answer.candidates.map((candidate) => {
                  const availabilityChecked = Boolean(answer.interpretedDate)

                  return (
                  <button
                    key={candidate.employee.id}
                    className="rounded-xl border bg-card p-4 text-left shadow-xs ring-1 ring-foreground/5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                    onClick={() => onSelectEmployee(candidate.employee)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold ring-1",
                            departmentTone(candidate.employee.department).avatar,
                          )}
                        >
                          {initials(candidate.employee.name)}
                        </div>
                        <div className="min-w-0">
                          <strong>{candidate.employee.name}</strong>
                          <p className="truncate text-sm text-muted-foreground">{candidate.employee.title}</p>
                          <p className="mt-1 font-mono text-xs text-primary">@{candidate.handle || employeeHandle(candidate.employee)}</p>
                        </div>
                      </div>
                      <Badge variant={availabilityChecked ? (candidate.available ? "default" : "destructive") : "outline"}>
                        {availabilityChecked ? (candidate.available ? "Disponible" : "Occupe") : "Profil"}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm">{candidate.reason}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Score vectoriel</span>
                      <span className="font-medium text-foreground">{candidate.score}</span>
                    </div>
                  </button>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Lance une recherche pour obtenir des profils disponibles.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MessagesPage({ companyId, employees }: { companyId: string; employees: EmployeeDTO[] }) {
  const client = useQueryClient()
  const conversations = useQuery({ queryKey: ["conversations", companyId], queryFn: () => getConversations(companyId) })
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
    if (!conversationId && conversations.data?.[0]) {
      setConversationId(conversations.data[0].id)
    }
  }, [conversationId, conversations.data])

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
    <div className="grid min-h-[640px] gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(conversations.data ?? []).map((conversation) => (
            <button
              key={conversation.id}
              className="rounded-md border p-3 text-left hover:bg-muted/60 data-[active=true]:border-primary"
              data-active={conversation.id === conversationId}
              onClick={() => setConversationId(conversation.id)}
              type="button"
            >
              <strong>{conversation.title ?? "Conversation directe"}</strong>
              <p className="text-xs text-muted-foreground">{readableDate(conversation.lastMessageAt)}</p>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{activeConversation?.title ?? "Messages"}</CardTitle>
          <CardDescription>{participantNames(activeConversation, employees)}</CardDescription>
        </CardHeader>
        <CardContent className="grid h-[500px] grid-rows-[1fr_auto] gap-3">
          <ScrollArea className="rounded-md border p-3">
            <div className="grid gap-3">
              {(messagesQuery.data ?? []).map((row) => (
                <MessageBubble key={row.id} message={row} employees={employees} />
              ))}
            </div>
          </ScrollArea>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message" />
            <Button type="submit" size="icon" disabled={!conversationId || mutation.isPending}>
              <Send />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function participantNames(conversation: ConversationDTO | null, employees: EmployeeDTO[]) {
  if (!conversation) {
    return "Selectionne une conversation"
  }

  return conversation.participantEmployeeIds
    .map((id) => employees.find((employee) => employee.id === id)?.name)
    .filter(Boolean)
    .join(", ")
}

function MessageBubble({ message, employees }: { message: MessageDTO; employees: EmployeeDTO[] }) {
  const sender = employees.find((employee) => employee.id === message.senderEmployeeId)
  return (
    <div className="rounded-md bg-muted p-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{sender?.name ?? "Employe"}</span>
        <span>{readableDate(message.createdAt)}</span>
      </div>
      <p className="mt-1 text-sm">{message.body}</p>
    </div>
  )
}

function PostVisual({ post }: { post: CommunityPostDTO }) {
  const imageUrl = assetUrl(post.imageUrl)

  if (imageUrl) {
    return (
      <div className="overflow-hidden bg-muted">
        <img alt={post.title} className="aspect-square w-full object-cover" src={imageUrl} />
      </div>
    )
  }

  return (
    <div className="grid aspect-square place-items-center bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.25),transparent_28%),linear-gradient(135deg,rgba(59,130,246,0.18),rgba(244,63,94,0.12))] p-10">
      <div className="max-w-sm text-center">
        <p className="font-heading text-2xl font-medium leading-tight">{post.title}</p>
        <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{post.body}</p>
      </div>
    </div>
  )
}

function CommunityPostCard({ post, employees }: { post: CommunityPostDTO; employees: EmployeeDTO[] }) {
  const author = employees.find((employee) => employee.id === post.authorEmployeeId)
  const tone = departmentTone(author?.department)

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm ring-1 ring-foreground/5">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold ring-1", tone.avatar)}>
            {initials(author?.name ?? "Equipe")}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{author?.name ?? "Equipe"}</div>
            <div className="truncate text-xs text-muted-foreground">
              {author?.title ?? "Publication interne"} · {readableDate(post.createdAt)}
            </div>
          </div>
        </div>
        <Button size="icon" type="button" variant="ghost">
          <MoreHorizontal />
        </Button>
      </header>
      <PostVisual post={post} />
      <div className="grid gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button size="icon" type="button" variant="ghost">
              <Heart />
            </Button>
            <Button size="icon" type="button" variant="ghost">
              <MessageCircle />
            </Button>
            <Button size="icon" type="button" variant="ghost">
              <Send />
            </Button>
          </div>
          <Button size="icon" type="button" variant="ghost">
            <Bookmark />
          </Button>
        </div>
        <div className="space-y-1.5 text-sm">
          <p>
            <span className="font-semibold">{author?.name ?? "Equipe"}</span>{" "}
            <span className="text-muted-foreground">{post.body}</span>
          </p>
          <button className="text-xs text-muted-foreground" type="button">
            Voir les commentaires
          </button>
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
    <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,640px)_360px] xl:items-start">
      <div className="grid gap-6">
        {(posts.data ?? []).map((post) => (
          <CommunityPostCard key={post.id} employees={employees} post={post} />
        ))}
        {posts.isLoading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Chargement du feed...</CardContent>
          </Card>
        ) : null}
      </div>
      <div className="xl:sticky xl:top-28">
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <ImagePlus className="size-5" />
              </div>
              <div>
                <CardTitle>Publier</CardTitle>
                <CardDescription>Image locale et legende interne.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <label className="grid cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed bg-muted/30 text-sm transition hover:bg-muted/60">
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
                <div className="grid aspect-square w-full place-items-center p-6 text-center">
                  <div>
                    <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-background text-primary ring-1 ring-border">
                      <Upload className="size-5" />
                    </div>
                    <div className="font-medium">Ajouter une image</div>
                    <div className="mt-1 text-xs text-muted-foreground">PNG, JPG, WebP ou GIF</div>
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
              className="min-h-28 resize-none"
              placeholder="Legende"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            {mutation.error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {mutation.error.message}
              </div>
            ) : null}
            <Button type="submit" disabled={mutation.isPending || (!body.trim() && !imageFile)}>
              <Plus />
              Publier
            </Button>
          </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

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
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Creer un groupe</CardTitle>
          <CardDescription>{employees.length} employes disponibles pour les groupes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <Input placeholder="Nom" value={name} onChange={(event) => setName(event.target.value)} />
            <Textarea
              placeholder="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <Button type="submit" disabled={mutation.isPending}>
              <Plus />
              Creer
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {(groups.data ?? []).map((group) => (
          <Card key={group.id} size="sm">
            <CardHeader>
              <CardTitle>{group.name}</CardTitle>
              <CardDescription>{group.description ?? "Aucune description"}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

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
      <Card>
        <CardHeader>
          <CardTitle>Acces admin requis</CardTitle>
          <CardDescription>Cette section est reservee aux owners et admins de l'entreprise.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Confidentialite des conversations</CardTitle>
          <CardDescription>
            Quand l'option est desactivee, l'admin ne voit que les metadonnees des conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <span className="text-sm">Lecture admin des messages</span>
          <Switch checked={adminCanRead} onCheckedChange={(checked) => mutation.mutate(checked)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Audit conversations</CardTitle>
          <CardDescription>Mode actuel: {admin.data?.mode ?? "chargement"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(admin.data?.conversations ?? []).map((conversation) => (
            <div key={conversation.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <strong>{conversation.title ?? conversation.type}</strong>
                <Badge variant="outline">{conversation.participantEmployeeIds.length} participants</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{readableDate(conversation.lastMessageAt)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function EmployeeSheet({
  companyId,
  employee,
  onOpenChange,
}: {
  companyId: string
  employee: EmployeeDTO | null
  onOpenChange: (open: boolean) => void
}) {
  const client = useQueryClient()
  const [title, setTitle] = useState("")
  const [startsAt, setStartsAt] = useState(localDateTime(24))
  const [endsAt, setEndsAt] = useState(localDateTime(25))
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

  return (
    <Sheet open={Boolean(employee)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {employee ? (
          <>
            <SheetHeader>
              <SheetTitle>{employee.name}</SheetTitle>
              <SheetDescription>{employee.title}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 p-4">
              <div className="grid gap-2 rounded-md border p-3">
                <Badge className="w-fit" variant="outline">
                  {employee.department ?? "Equipe"}
                </Badge>
                <p className="text-sm leading-relaxed">{employee.jobDescription}</p>
              </div>
              <Separator />
              <div className="grid gap-2">
                <h3 className="font-medium">Evenements</h3>
                {(events.data ?? []).map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
              <form
                className="grid gap-2 rounded-md border p-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  mutation.mutate()
                }}
              >
                <Label>Ajouter un evenement</Label>
                <Input placeholder="Titre" value={title} onChange={(event) => setTitle(event.target.value)} required />
                <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                <Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
                <Button type="submit" disabled={mutation.isPending}>
                  <CalendarPlus />
                  Ajouter
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
    <div className="rounded-md bg-muted p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <strong>{event.title}</strong>
        <Badge variant="outline">{event.type}</Badge>
      </div>
      <p className="text-muted-foreground">
        {readableDate(event.startsAt)} - {readableDate(event.endsAt)}
      </p>
    </div>
  )
}

function AppShell() {
  const client = useQueryClient()
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false })
  const [section, setSection] = useState<Section>("dashboard")
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDTO | null>(null)
  const companyId = me.data?.activeCompanyId ?? null
  const membership = me.data?.memberships.find((item) => item.companyId === companyId) ?? null
  const isAdmin = membership?.role === "owner" || membership?.role === "admin"
  const employeesQuery = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => getEmployees(companyId!),
    enabled: Boolean(companyId),
  })
  const employees = employeesQuery.data ?? []

  if (me.isLoading) {
    return <main className="grid min-h-svh place-items-center text-sm text-muted-foreground">Chargement...</main>
  }

  if (me.error) {
    return <LoginScreen onSignedIn={() => void client.invalidateQueries({ queryKey: ["me"] })} />
  }

  if (!companyId || !membership) {
    return <main className="grid min-h-svh place-items-center">Aucune entreprise associee.</main>
  }

  const activeSection = sectionCopy[section]

  return (
    <div className="min-h-svh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-[17rem] border-r bg-sidebar/95 p-3 lg:block">
        <div className="mb-4 rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GitBranch className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-medium">Companinator</h1>
              <p className="truncate text-xs text-muted-foreground">{membership.company.name}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
            <span className="text-muted-foreground">Workspace</span>
            <Badge variant="outline" className="rounded-md bg-background">
              {membership.role}
            </Badge>
          </div>
        </div>
        <nav className="grid gap-1">
          {sections.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.id}
                className={cn(
                  "h-10 justify-start rounded-lg",
                  section === item.id && "bg-background shadow-sm ring-1 ring-border",
                )}
                variant={section === item.id ? "secondary" : "ghost"}
                onClick={() => setSection(item.id)}
              >
                <Icon />
                {item.label}
                {section === item.id ? <ChevronRight className="ml-auto size-4" /> : null}
              </Button>
            )
          })}
        </nav>
      </aside>
      <main className="lg:pl-[17rem]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:px-6">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="outline" className="rounded-md">
                {membership.company.name}
              </Badge>
              <span className="text-xs text-muted-foreground">{membership.role}</span>
            </div>
            <h2 className="font-heading text-xl font-medium">{activeSection.title}</h2>
            <p className="text-sm text-muted-foreground">{activeSection.subtitle}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void signOut().finally(() => client.clear())
            }}
          >
            Deconnexion
          </Button>
        </header>
        <div className="p-4 lg:p-6">
          <div className="mb-4 grid grid-cols-2 gap-2 lg:hidden">
            {sections.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={section === item.id ? "secondary" : "outline"}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {section === "dashboard" ? <DashboardPage companyId={companyId} /> : null}
          {section === "hierarchy" ? (
            <HierarchyPage companyId={companyId} onSelectEmployee={setSelectedEmployee} />
          ) : null}
          {section === "employees" ? (
            <EmployeesPage companyId={companyId} employees={employees} onSelectEmployee={setSelectedEmployee} />
          ) : null}
          {section === "assistant" ? <AssistantPage companyId={companyId} onSelectEmployee={setSelectedEmployee} /> : null}
          {section === "messages" ? <MessagesPage companyId={companyId} employees={employees} /> : null}
          {section === "community" ? <CommunityPage companyId={companyId} employees={employees} /> : null}
          {section === "groups" ? <GroupsPage companyId={companyId} employees={employees} /> : null}
          {section === "admin" ? (
            <AdminPage
              companyId={companyId}
              adminCanRead={membership.company.adminCanReadConversations}
              isAdmin={isAdmin}
            />
          ) : null}
        </div>
      </main>
      <EmployeeSheet companyId={companyId} employee={selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)} />
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
