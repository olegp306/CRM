"use server";

import {
  captureAssistantContext,
  createAssistantPersistenceDraft,
  createAssistantSubmissionResult,
  createOnboardingFeedbackContent,
  findOnboardingQuestion
} from "@app/assistant";
import { revalidatePath } from "next/cache";
import { getWorkspaceSession } from "../../workspace-session";
import { getAssistantRepository } from "../assistant/repository";

export type SubmitOnboardingAnswerInput = {
  questionId: string;
  answer: string;
  threadId: string;
  messageId: string;
};

export async function submitOnboardingAnswerAction(input: SubmitOnboardingAnswerInput) {
  const question = findOnboardingQuestion(input.questionId);

  if (!question) {
    throw new Error(`Onboarding question ${input.questionId} was not found.`);
  }

  const answer = input.answer.trim();

  if (!answer) {
    throw new Error("Onboarding answer is required.");
  }

  const session = await getWorkspaceSession();
  const context = captureAssistantContext({
    workspaceId: session.workspaceId,
    userId: session.userId,
    role: session.role,
    route: "/onboarding",
    module: question.moduleContext
  });
  const result = createAssistantSubmissionResult({
    context,
    content: createOnboardingFeedbackContent({ question, answer }),
    threadId: input.threadId,
    messageId: input.messageId
  });
  const persistenceDraft = createAssistantPersistenceDraft(result, {
    threadId: input.threadId,
    messageId: input.messageId
  });
  const repository = getAssistantRepository();

  await repository.save(persistenceDraft);
  revalidatePath("/platform/feedback");

  return {
    response: result.response,
    feedback: result.feedback,
    saved: Boolean(result.feedback)
  };
}
