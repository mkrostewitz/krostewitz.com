import {getApolloOptions} from "./apolloOptions.mjs";
import {ApolloEnrichmentError} from "./apolloEnrichment.mjs";

export async function getApolloSender({emailAccountId, apiKey, fetchImpl = fetch}) {
  if (!/^[a-f0-9]{24}$/i.test(emailAccountId || "")) throw new ApolloEnrichmentError("Choose a sending account in Apollo Integrations.", 400);
  const {options} = await getApolloOptions({kind: "accounts", apiKey, fetchImpl});
  const selected = options.find(account => account.id === emailAccountId);
  if (!selected || selected.disabled) throw new ApolloEnrichmentError("The sending account selected in Integrations is missing or disconnected. Reconnect it or select another account before enrolling.", 400);
  if (!selected.label.includes("@")) throw new ApolloEnrichmentError("Apollo did not return an email address for the selected sending account.", 502);
  return {id: selected.id, email: selected.label};
}

export function apolloSenderStatus(membership, sender) {
  if (!membership || !sender?.id) return "unknown";
  const id = membership.send_email_from_email_account_id;
  const email = membership.send_email_from_email_address;
  if (id && id !== sender.id) return "mismatch";
  if (email && sender.email && email.toLowerCase() !== sender.email.toLowerCase()) return "mismatch";
  return id === sender.id ? "verified" : "unknown";
}
