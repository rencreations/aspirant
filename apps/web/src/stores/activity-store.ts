import { Store } from "@tanstack/react-store";

export interface ActivityEntry {
  id: number;
  message: string;
}

let nextId = 1;

/** TanStack Store: tiny reactive log shared by the Data lab widgets. */
export const activityStore = new Store<ActivityEntry[]>([]);

export function logActivity(message: string) {
  activityStore.setState((prev) => [{ id: nextId++, message }, ...prev].slice(0, 6));
}
