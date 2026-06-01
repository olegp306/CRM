type LeadExportWhere = {
  workspaceId: string;
  archivedAt: null;
  createdDate?: {
    gte: Date;
    lt: Date;
  };
  temperature?: "hot" | "warm" | "cold";
  status?: string;
};

export function createLeadExportWhereFromUrl(
  workspaceId: string,
  url: string,
  options: { now?: Date } = {}
): LeadExportWhere {
  const searchParams = new URL(url).searchParams;
  const where: LeadExportWhere = {
    workspaceId,
    archivedAt: null
  };
  const dateRange = createLeadExportDateRange(searchParams.get("date"), options.now ?? new Date());

  if (dateRange) {
    where.createdDate = dateRange;
  }

  const temperature = normalizeTemperature(searchParams.get("temperature"));
  if (temperature) {
    where.temperature = temperature;
  }

  const status = searchParams.get("status")?.trim();
  if (status) {
    where.status = status;
  }

  return where;
}

function normalizeTemperature(value: string | null): "hot" | "warm" | "cold" | null {
  return value === "hot" || value === "warm" || value === "cold" ? value : null;
}

function createLeadExportDateRange(datePreset: string | null, now: Date): { gte: Date; lt: Date } | null {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  if (datePreset === "current_month") {
    return {
      gte: new Date(Date.UTC(year, month, 1)),
      lt: new Date(Date.UTC(year, month + 1, 1))
    };
  }

  if (datePreset === "last_month") {
    return {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1))
    };
  }

  return null;
}
