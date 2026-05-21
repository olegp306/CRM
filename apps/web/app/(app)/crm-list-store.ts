import { prisma } from "@app/db";

type ClientRecord = {
  id: string;
  clientId: string;
  name: string;
  clientType: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
};

type LeadRecord = {
  id: string;
  leadId: string;
  requestType: string | null;
  status: string;
  projectAddress: string | null;
  rawInput: string | null;
};

type ProjectRecord = {
  id: string;
  projectId: string;
  projectName: string;
  projectType: string | null;
  status: string;
  currentPhase: string | null;
  projectAddress: string | null;
};

export type CrmListRow = {
  id: string;
  primary: string;
  secondary: string;
  detail: string;
  meta: string;
};

export type CrmListKind = "clients" | "leads" | "projects";

function compactJoin(parts: Array<string | null | undefined>, separator: string): string {
  return parts.filter(Boolean).join(separator);
}

export function getCrmEmptyStateMessage(kind: CrmListKind): string {
  const labels: Record<CrmListKind, string> = {
    clients: "clients",
    leads: "leads",
    projects: "projects"
  };

  return `No ${labels[kind]} found yet.`;
}

export function createClientListViewModel(records: ClientRecord[]): CrmListRow[] {
  return records.map((client) => ({
    id: client.id,
    primary: client.name,
    secondary: compactJoin([client.clientId, client.clientType, client.status], " · "),
    detail: compactJoin([client.email, client.phone], " · "),
    meta: client.source ?? ""
  }));
}

export function createLeadListViewModel(records: LeadRecord[]): CrmListRow[] {
  return records.map((lead) => ({
    id: lead.id,
    primary: lead.leadId,
    secondary: compactJoin([lead.requestType, lead.status], " · "),
    detail: lead.projectAddress ?? "",
    meta: lead.rawInput ?? ""
  }));
}

export function createProjectListViewModel(records: ProjectRecord[]): CrmListRow[] {
  return records.map((project) => ({
    id: project.id,
    primary: project.projectName,
    secondary: compactJoin([project.projectId, project.projectType, project.status], " · "),
    detail: project.projectAddress ?? "",
    meta: project.currentPhase ?? ""
  }));
}

export async function listClientRows(workspaceId: string): Promise<CrmListRow[]> {
  const records = await prisma.client.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ createdDate: "desc" }, { clientId: "asc" }],
    select: {
      id: true,
      clientId: true,
      name: true,
      clientType: true,
      email: true,
      phone: true,
      status: true,
      source: true
    }
  });

  return createClientListViewModel(records);
}

export async function listLeadRows(workspaceId: string): Promise<CrmListRow[]> {
  const records = await prisma.lead.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ createdDate: "desc" }, { leadId: "asc" }],
    select: {
      id: true,
      leadId: true,
      requestType: true,
      status: true,
      projectAddress: true,
      rawInput: true
    }
  });

  return createLeadListViewModel(records);
}

export async function listProjectRows(workspaceId: string): Promise<CrmListRow[]> {
  const records = await prisma.project.findMany({
    where: { workspaceId, archivedAt: null },
    orderBy: [{ createdAt: "desc" }, { projectId: "asc" }],
    select: {
      id: true,
      projectId: true,
      projectName: true,
      projectType: true,
      status: true,
      currentPhase: true,
      projectAddress: true
    }
  });

  return createProjectListViewModel(records);
}
