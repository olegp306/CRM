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

  if (/(confusing|uncomfortable|neudobno|neponyatno|неудобно|непонятно)/.test(text)) {
    return "ux_feedback";
  }

  if (
    /\b(add|create|build|upload)\b.*\b(button|column|tab|view|theme|upload|feature|interface|assistant ui|ui|version compare|compare kp versions)\b/.test(
      text,
    )
  ) {
    return "feature_request";
  }

  if (
    /^(help me\s+)?(add|create|generate|schedule|update|mark|set|record|undo|revert|clear|remove)\b.*\b(lead|address|kp|follow-up|project|task)\b/.test(
      text,
    )
  ) {
    return "crm_action";
  }

  if (/\b(undo|revert|clear|remove)\b.*\b(kp|offer|proposal|lead)\b/.test(text)) {
    return "crm_action";
  }

  if (/(кп|коммерческ\w*\s+предложен\w*).{0,32}(отправ|выслал|выслали|сгенер|созда|подготов|отмени|откат|верни|убери)/i.test(text)) {
    return "crm_action";
  }

  if (/(сгенер|созда|подготов|сделай).{0,32}(кп|коммерческ\w*\s+предложен\w*)/i.test(text)) {
    return "crm_action";
  }

  if (/(отмени|откат|верни|убери).{0,32}(кп|коммерческ\w*\s+предложен\w*|отправ)/i.test(text)) {
    return "crm_action";
  }

  if (
    /(\b(what|where|when|status|does|is)\b.*\b(lead|kp|project|commercial proposal)\b|\b(lead|kp|project|commercial proposal)\b.*\b(status|commercial proposal)\b)/.test(
      text,
    )
  ) {
    return "support_request";
  }

  if (/(что|какой|где|когда|статус|дальше|следующ).{0,48}(лид|кп|проект|коммерческ\w*\s+предложен\w*)/i.test(text)) {
    return "support_request";
  }

  if (
    /(who are you|what can you do|help|\bhow\b|\bwhy\b|translate|kak sdelat|pomogi|переведи|кто ты|что умеешь|помоги|как сделать|почему|зачем)/.test(
      text,
    )
  ) {
    return "support_request";
  }

  if (
    /(feature|please add|would be nice|i want to add|feature request|dobavit|hotelos by|добавьте|хочу добавить|хотелось бы|сделайте возможность|нужна функция)/.test(
      text,
    )
  ) {
    return "feature_request";
  }

  if (
    /(create|add|generate|schedule|update|mark|set|record|sozdaj|dobav|sgeneriruj|postav|otmet|создай|добавь|сгенерируй|поставь|отметь|запиши)/.test(
      text,
    )
  ) {
    return "crm_action";
  }

  return "other";
}
