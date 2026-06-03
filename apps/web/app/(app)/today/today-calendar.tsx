"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createLeadCalendarMonthViewModel,
  shiftLeadCalendarMonth,
  type LeadCalendarItem
} from "../leads/lead-table-store";
import type { TodayCalendarViewModel } from "./today-store";

export function TodayCalendar({ calendar }: { calendar: TodayCalendarViewModel }) {
  const [visibleMonth, setVisibleMonth] = useState(calendar.initialMonth);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(calendar.todayItems[0]?.date ?? calendar.items[0]?.date ?? null);
  const month = createLeadCalendarMonthViewModel(visibleMonth, calendar.items);
  const selectedItems = selectedDate ? calendar.items.filter((item) => item.date === selectedDate) : [];

  useEffect(() => {
    setVisibleMonth(calendar.initialMonth);
    setSelectedDate(calendar.todayItems[0]?.date ?? calendar.items[0]?.date ?? null);
  }, [calendar.initialMonth, calendar.items, calendar.todayItems]);

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Next workspace action</p>
            <p className="mt-1 text-base font-semibold text-foreground">{calendar.nextSummary}</p>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            {calendar.items.length} planned
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          <p className="text-sm font-semibold text-foreground">Today</p>
          <CalendarItemList items={calendar.todayItems} emptyText="No actions scheduled for today." />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => shiftLeadCalendarMonth(current, -1))}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground"
            >
              Prev
            </button>
            <h2 className="min-w-36 text-center text-base font-semibold text-foreground">{month.monthLabel}</h2>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => shiftLeadCalendarMonth(current, 1))}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground"
            >
              Next
            </button>
          </div>
          <div className="flex rounded-md border border-border bg-muted/40 p-1">
            {(["calendar", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${
                  viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {mode === "calendar" ? "Calendar" : "List"}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "calendar" ? (
          <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>
              <div className="mt-1 grid gap-1">
                {month.weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7 gap-1">
                    {week.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        disabled={day.itemCount === 0}
                        onClick={() => setSelectedDate(day.date)}
                        title={day.itemCount > 0 ? `${day.itemCount} action on ${day.date}` : day.date}
                        className={`min-h-14 min-w-0 rounded-md border p-1 text-left text-[11px] ${
                          day.itemCount > 0
                            ? selectedDate === day.date
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-primary/40 bg-primary/10 text-foreground"
                            : day.isCurrentMonth
                              ? "border-border bg-muted/40 text-foreground"
                              : "border-transparent bg-transparent text-muted-foreground/50"
                        }`}
                      >
                        <span className="font-semibold">{day.day}</span>
                        {day.itemCount > 0 ? (
                          <span className="mt-1 block truncate text-[10px] font-semibold">{day.itemCount} item{day.itemCount > 1 ? "s" : ""}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <CalendarItemList
              items={selectedItems}
              emptyText={selectedDate ? `No actions on ${selectedDate}.` : "Pick a highlighted date to see details."}
            />
          </div>
        ) : (
          <div className="mt-4">
            <CalendarItemList items={calendar.items} emptyText="No planned workspace actions yet." />
          </div>
        )}
      </section>
    </div>
  );
}

function CalendarItemList({ items, emptyText }: { items: LeadCalendarItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="grid min-w-0 gap-2">
      {items.map((item) => (
        <article key={item.id} className="min-w-0 rounded-lg border border-border bg-white p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words font-semibold text-foreground">{item.title}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {item.date}
                {item.leadName ? ` · ${item.leadName}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${getCalendarBadgeClassName(item.badgeTone)}`}>
                {item.badgeLabel}
              </span>
              <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">{item.status}</span>
            </div>
          </div>
          <p className="mt-2 break-words text-sm text-muted-foreground">{item.description}</p>
          {item.leadId ? (
            <Link
              href={`/leads?leadId=${encodeURIComponent(item.leadId)}`}
              className="mt-3 inline-flex rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground"
            >
              Open lead
            </Link>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function getCalendarBadgeClassName(tone: LeadCalendarItem["badgeTone"]): string {
  if (tone === "rose") return "bg-rose-50 text-rose-700";
  if (tone === "emerald") return "bg-emerald-50 text-emerald-700";
  if (tone === "blue") return "bg-blue-50 text-blue-700";
  if (tone === "amber") return "bg-amber-50 text-amber-700";
  return "bg-muted text-muted-foreground";
}
