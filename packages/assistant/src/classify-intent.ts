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

  if (/(bug|broken|does not work|error|ne rabotaet|oshibka|не работает|ошибка|РЅРµ СЂР°Р±РѕС‚Р°РµС‚|РѕС€РёР±РєР°)/.test(text)) {
    return "bug_report";
  }

  if (
    /(who are you|what can you do|help|\bhow\b|\bwhy\b|translate|kak sdelat|pomogi|переведи|кто ты|что умеешь|помоги|как сделать|почему|зачем|РєР°Рє СЃРґРµР»Р°С‚СЊ|РїРѕРјРѕРіРё)/.test(
      text,
    )
  ) {
    return "support_request";
  }

  if (
    /(feature|please add|would be nice|i want to add|feature request|dobavit|hotelos by|добавьте|хочу добавить|хотелось бы|сделайте возможность|нужна функция|РґРѕР±Р°РІРёС‚СЊ|С…РѕС‚РµР»РѕСЃСЊ Р±С‹)/.test(
      text,
    )
  ) {
    return "feature_request";
  }

  if (
    /(create|add|generate|schedule|update|mark|set|record|sozdaj|dobav|sgeneriruj|postav|otmet|создай|добавь|сгенерируй|поставь|отметь|запиши|СЃРѕР·РґР°Р№|РґРѕР±Р°РІСЊ|СЃРіРµРЅРµСЂРёСЂСѓР№|РїРѕСЃС‚Р°РІСЊ|РѕС‚РјРµС‚СЊ|Р·Р°РїРёС€Рё)/.test(
      text,
    )
  ) {
    return "crm_action";
  }

  if (/(confusing|uncomfortable|neudobno|neponyatno|неудобно|непонятно|РЅРµСѓРґРѕР±РЅРѕ|РЅРµРїРѕРЅСЏС‚РЅРѕ)/.test(text)) {
    return "ux_feedback";
  }

  return "other";
}
