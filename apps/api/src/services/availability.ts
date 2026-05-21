import type { Employee, EmployeeEvent } from "../db/schema"

export function inferRole(query: string) {
  const normalized = query.toLowerCase()
  const rules = [
    { role: "developpeur", terms: ["dev", "developpeur", "developer", "frontend", "backend", "fullstack"] },
    { role: "designer", terms: ["designer", "design", "ux", "ui"] },
    { role: "commercial", terms: ["commercial", "sales", "vente"] },
    { role: "rh", terms: ["rh", "recrutement", "people", "hr"] },
    { role: "product", terms: ["product", "produit", "po"] },
    { role: "data", terms: ["data", "analytics", "analyste"] },
    { role: "manager", terms: ["manager", "lead", "responsable"] },
  ]

  return rules.find((rule) => rule.terms.some((term) => normalized.includes(term)))?.role ?? null
}

export function inferDate(query: string, now = new Date()) {
  const normalized = query.toLowerCase()
  const base = new Date(now)
  base.setHours(0, 0, 0, 0)

  if (normalized.includes("demain")) {
    base.setDate(base.getDate() + 1)
    return base
  }

  if (normalized.includes("apres-demain") || normalized.includes("apres demain")) {
    base.setDate(base.getDate() + 2)
    return base
  }

  if (normalized.includes("aujourd")) {
    return base
  }

  const isoDate = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (isoDate?.[1]) {
    return new Date(`${isoDate[1]}T00:00:00.000Z`)
  }

  return null
}

export function parseLocalDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0)
}

export function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function businessWindow(date: Date) {
  const start = new Date(date)
  start.setHours(9, 0, 0, 0)

  const end = new Date(date)
  end.setHours(18, 0, 0, 0)

  return { start, end }
}

export function findFirstFreeSlot(events: EmployeeEvent[], date: Date, durationMinutes = 30) {
  const { start, end } = businessWindow(date)
  let cursor = start.getTime()
  const duration = durationMinutes * 60 * 1000

  const sorted = events
    .filter((event) => event.endsAt > start && event.startsAt < end)
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())

  for (const event of sorted) {
    if (event.startsAt.getTime() - cursor >= duration) {
      return new Date(cursor)
    }
    cursor = Math.max(cursor, event.endsAt.getTime())
  }

  if (end.getTime() - cursor >= duration) {
    return new Date(cursor)
  }

  return null
}

export function titleMatchesRole(employee: Employee, role: string | null) {
  if (!role) {
    return true
  }

  const haystack = `${employee.title} ${employee.department ?? ""} ${employee.jobDescription}`.toLowerCase()
  if (role === "developpeur") {
    return ["dev", "developpeur", "developer", "frontend", "backend", "fullstack", "ingenieur"].some((term) =>
      haystack.includes(term),
    )
  }

  return haystack.includes(role)
}
