import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 1000 * 60 * 60 * 24,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** One QueryClient per server render, one shared instance in the browser. */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
