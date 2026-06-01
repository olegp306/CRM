"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../workspace-session";
import { clearWorkspaceLeadTable } from "./danger-zone-store";

export type ClearLeadTableActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialClearLeadTableActionState: ClearLeadTableActionState = {
  status: "idle",
  message: ""
};

export async function clearLeadTableAction(
  _state: ClearLeadTableActionState,
  formData: FormData
): Promise<ClearLeadTableActionState> {
  const session = await getWorkspaceSession();
  const password = formData.get("password");

  if (typeof password !== "string" || password.trim() === "") {
    return { status: "error", message: "Enter the confirmation password." };
  }

  try {
    const result = await clearWorkspaceLeadTable(prisma, {
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      password: password.trim()
    });

    revalidatePath("/leads");
    revalidatePath("/settings");

    return {
      status: "success",
      message: `Lead table cleared. Deleted ${result.deletedCount} lead row${result.deletedCount === 1 ? "" : "s"}.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not clear the lead table."
    };
  }
}
