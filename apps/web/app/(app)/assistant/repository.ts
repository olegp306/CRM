import { createAssistantMemoryRepository, type AssistantRepositoryContract } from "@app/assistant";
import { createAssistantPrismaRepository, prisma } from "@app/db";
import { selectDatabaseBackedRuntime } from "../../../lib/database-runtime";

const globalForAssistant = globalThis as typeof globalThis & {
  assistantRepository?: ReturnType<typeof createAssistantMemoryRepository>;
  assistantPrismaRepository?: AssistantRepositoryContract;
};

export function selectAssistantRepositoryRuntime<TRepository>({
  databaseUrl,
  nodeEnv,
  memoryRepository,
  prismaRepository
}: {
  databaseUrl?: string;
  nodeEnv?: string;
  memoryRepository: TRepository;
  prismaRepository: TRepository;
}): TRepository {
  return selectDatabaseBackedRuntime({
    databaseUrl,
    nodeEnv,
    memoryRuntime: memoryRepository,
    databaseRuntime: prismaRepository,
    runtimeName: "assistant repository"
  });
}

export function getAssistantRepository() {
  if (
    !globalForAssistant.assistantRepository ||
    !("listAuditEvents" in globalForAssistant.assistantRepository) ||
    !("updateFeedbackStatus" in globalForAssistant.assistantRepository)
  ) {
    globalForAssistant.assistantRepository = createAssistantMemoryRepository();
  }

  if (!globalForAssistant.assistantPrismaRepository) {
    globalForAssistant.assistantPrismaRepository = createAssistantPrismaRepository(prisma);
  }

  return selectAssistantRepositoryRuntime({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    memoryRepository: globalForAssistant.assistantRepository,
    prismaRepository: globalForAssistant.assistantPrismaRepository
  });
}
