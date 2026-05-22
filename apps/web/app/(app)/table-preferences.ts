"use client";

import { useEffect, useState } from "react";
import type { ColumnSizingState, VisibilityState } from "@tanstack/react-table";

export type TablePreferences = {
  columnVisibility: VisibilityState;
  columnSizing: ColumnSizingState;
};

const emptyPreferences: TablePreferences = {
  columnVisibility: {},
  columnSizing: {}
};

export function getTablePreferencesStorageKey(tableId: string): string {
  return `crm.table.${tableId}.preferences.v1`;
}

export function normalizeTablePreferences(input: unknown): TablePreferences {
  if (!isRecord(input)) {
    return emptyPreferences;
  }

  return {
    columnVisibility: normalizeColumnVisibility(input.columnVisibility),
    columnSizing: normalizeColumnSizing(input.columnSizing)
  };
}

export function usePersistentTablePreferences(tableId: string) {
  const [hydrated, setHydrated] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const storageKey = getTablePreferencesStorageKey(tableId);

  useEffect(() => {
    const stored = readTablePreferences(storageKey);

    setColumnVisibility(stored.columnVisibility);
    setColumnSizing(stored.columnSizing);
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    writeTablePreferences(storageKey, {
      columnVisibility,
      columnSizing
    });
  }, [columnSizing, columnVisibility, hydrated, storageKey]);

  return {
    columnVisibility,
    columnSizing,
    setColumnVisibility,
    setColumnSizing
  };
}

function readTablePreferences(storageKey: string): TablePreferences {
  if (typeof window === "undefined") {
    return emptyPreferences;
  }

  try {
    return normalizeTablePreferences(JSON.parse(window.localStorage.getItem(storageKey) ?? "null"));
  } catch {
    return emptyPreferences;
  }
}

function writeTablePreferences(storageKey: string, preferences: TablePreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

function normalizeColumnVisibility(input: unknown): VisibilityState {
  if (!isRecord(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
  );
}

function normalizeColumnSizing(input: unknown): ColumnSizingState {
  if (!isRecord(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
  );
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}
