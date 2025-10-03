// server/services/graphService.js
import { graphfi } from "@pnp/graph";
import "@pnp/graph/mail/messages";

export function getGraphClient(accessToken) {
  return graphfi({
    fetchClientFactory: () => ({
      fetch: (url, options) => {
        options.headers = { ...options.headers, Authorization: `Bearer ${accessToken}` };
        return fetch(url, options);
      },
    }),
  });
}
