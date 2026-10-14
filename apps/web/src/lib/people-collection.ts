import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";

import { fetchPeople } from "@/lib/people";
import { getQueryClient } from "@/lib/query-client";

/**
 * TanStack DB collection backed by TanStack Query. Collections sync lazily (on first
 * subscription), so nothing is fetched during static prerender.
 */
export const peopleCollection = createCollection(
  queryCollectionOptions({
    queryKey: ["people"],
    queryFn: fetchPeople,
    queryClient: getQueryClient(),
    getKey: (person) => person.id,
  }),
);
