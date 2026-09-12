import { describe, it, expect } from "vitest"

import "@/test/mocks/next-link"

import { render, screen } from "@/test/utils/render"
import {
  StatusBadge,
  AdminTable,
  TextField,
  TextAreaField,
  SelectField,
  PageHeader,
  SetupNotice,
  EmptyState,
  StatCard,
  Panel,
  BuilderLink,
} from "@/components/admin/admin-ui"

describe("StatusBadge", () => {
  it("renders approved status with emerald tone", () => {
    render(<StatusBadge>approved</StatusBadge>)
    const badge = screen.getByText("approved")
    expect(badge).toHaveClass("bg-emerald-50", "text-emerald-700", "ring-emerald-200")
  })

  it("renders active status with emerald tone", () => {
    render(<StatusBadge>active</StatusBadge>)
    const badge = screen.getByText("active")
    expect(badge).toHaveClass("bg-emerald-50", "text-emerald-700", "ring-emerald-200")
  })

  it("renders published status with emerald tone", () => {
    render(<StatusBadge>published</StatusBadge>)
    const badge = screen.getByText("published")
    expect(badge).toHaveClass("bg-emerald-50", "text-emerald-700", "ring-emerald-200")
  })

  it("renders pending status with amber tone", () => {
    render(<StatusBadge>pending</StatusBadge>)
    const badge = screen.getByText("pending")
    expect(badge).toHaveClass("bg-amber-50", "text-amber-700", "ring-amber-200")
  })

  it("renders under_review status with amber tone", () => {
    render(<StatusBadge>under_review</StatusBadge>)
    const badge = screen.getByText("under review")
    expect(badge).toHaveClass("bg-amber-50", "text-amber-700", "ring-amber-200")
  })

  it("renders rejected status with rose tone", () => {
    render(<StatusBadge>rejected</StatusBadge>)
    const badge = screen.getByText("rejected")
    expect(badge).toHaveClass("bg-rose-50", "text-rose-700", "ring-rose-200")
  })

  it("renders suspended status with rose tone", () => {
    render(<StatusBadge>suspended</StatusBadge>)
    const badge = screen.getByText("suspended")
    expect(badge).toHaveClass("bg-rose-50", "text-rose-700", "ring-rose-200")
  })

  it("renders unknown status with slate tone", () => {
    render(<StatusBadge>unknown_status</StatusBadge>)
    const badge = screen.getByText("unknown status")
    expect(badge).toHaveClass("bg-slate-100", "text-slate-700", "ring-slate-200")
  })
})

describe("AdminTable", () => {
  it("renders empty state when rows are empty", () => {
    render(<AdminTable columns={["Name"]} rows={[]} />)
    expect(screen.getByText("No records yet")).toBeInTheDocument()
  })

  it("renders column headers", () => {
    render(<AdminTable columns={["Name", "Email"]} rows={[["Alice", "alice@example.com"]]} />)
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
  })

  it("renders rows", () => {
    render(<AdminTable columns={["Name"]} rows={[["Alice"], ["Bob"]]} />)
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
  })
})

describe("TextField", () => {
  it("renders label and input", () => {
    render(<TextField name="email" label="Email" />)
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("name", "email")
  })

  it("renders with type email", () => {
    render(<TextField name="email" label="Email" type="email" />)
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("type", "email")
  })

  it("marks input as required", () => {
    render(<TextField name="email" label="Email" required />)
    expect(screen.getByRole("textbox", { name: "Email" })).toBeRequired()
  })

  it("renders placeholder", () => {
    render(<TextField name="email" label="Email" placeholder="Enter email" />)
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("placeholder", "Enter email")
  })
})

describe("TextAreaField", () => {
  it("renders label and textarea", () => {
    render(<TextAreaField name="message" label="Message" />)
    expect(screen.getByText("Message")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute("name", "message")
  })

  it("renders with custom rows", () => {
    render(<TextAreaField name="message" label="Message" rows={6} />)
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute("rows", "6")
  })

  it("marks textarea as required", () => {
    render(<TextAreaField name="message" label="Message" required />)
    expect(screen.getByRole("textbox", { name: "Message" })).toBeRequired()
  })
})

describe("SelectField", () => {
  it("renders label and select", () => {
    render(
      <SelectField
        name="status"
        label="Status"
        options={[
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
      />
    )
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveAttribute("name", "status")
  })

  it("renders options", () => {
    render(
      <SelectField
        name="status"
        label="Status"
        options={[
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
      />
    )
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText("Inactive")).toBeInTheDocument()
  })
})

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(<PageHeader title="Dashboard" description="Overview" />)
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Overview")).toBeInTheDocument()
  })

  it("renders action when provided", () => {
    render(<PageHeader title="Dashboard" description="Overview" action={<button>Add</button>} />)
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument()
  })
})

describe("SetupNotice", () => {
  it("renders message", () => {
    render(<SetupNotice message="Supabase not configured" />)
    expect(screen.getByText("Supabase setup needed")).toBeInTheDocument()
    expect(screen.getByText("Supabase not configured")).toBeInTheDocument()
  })
})

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No data" description="Add some records" />)
    expect(screen.getByText("No data")).toBeInTheDocument()
    expect(screen.getByText("Add some records")).toBeInTheDocument()
  })
})

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Users" value={42} />)
    expect(screen.getByText("Users")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("renders detail when provided", () => {
    render(<StatCard label="Users" value={42} detail="+5 today" />)
    expect(screen.getByText("+5 today")).toBeInTheDocument()
  })
})

describe("Panel", () => {
  it("renders title and children", () => {
    render(<Panel title="Settings">Content</Panel>)
    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.getByText("Content")).toBeInTheDocument()
  })
})

describe("BuilderLink", () => {
  it("renders link to course builder", () => {
    render(<BuilderLink id="course-1" />)
    const link = screen.getByRole("link", { name: "Builder" })
    expect(link).toHaveAttribute("href", "/admin/course-builder/course-1")
  })
})
