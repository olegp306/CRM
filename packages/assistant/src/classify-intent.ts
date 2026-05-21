export type AssistantIntent =
  | "crm_action"
  | "support_request"
  | "bug_report"
  | "feature_request"
  | "ux_feedback"
  | "business_process_note"
  | "permission_blocked"
  | "other";

export function classifyIntent(message: string): AssistantIntent {
  const text = message.toLowerCase();

  if (/(bug|broken|does not work|error|ne rabotaet|oshibka|не работает|ошибка)/.test(text)) {
    return "bug_report";
  }

  if (/(feature|please add|would be nice|dobavit|hotelos by|добавить|хотелось бы)/.test(text)) {
    return "feature_request";
  }

  if (/(create|add|generate|schedule|update|mark|set|record|sozdaj|dobav|sgeneriruj|postav|otmet|создай|добавь|сгенерируй|поставь|отметь|запиши)/.test(text)) {
    return "crm_action";
  }

  if (/(confusing|uncomfortable|neudobno|neponyatno|неудобно|непонятно)/.test(text)) {
    return "ux_feedback";
  }

  if (/(how do i|help|kak sdelat|pomogi|как сделать|помоги)/.test(text)) {
    return "support_request";
  }

  return "other";
}
