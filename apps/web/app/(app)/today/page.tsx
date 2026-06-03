import { getWorkspaceSession } from "../../workspace-session";
import { TodayCalendar } from "./today-calendar";
import { listWorkspaceCalendar } from "./today-store";

export default async function TodayPage() {
  const session = await getWorkspaceSession();
  const calendar = await listWorkspaceCalendar(session.workspaceId);

  return (
    <section className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-muted-foreground">Workspace action calendar, follow-ups, birthdays, reminders and planned lead work.</p>
      </div>
      <TodayCalendar calendar={calendar} />
    </section>
  );
}
