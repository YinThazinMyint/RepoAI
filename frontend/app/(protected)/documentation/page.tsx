import { DocumentationWorkspace } from "@/components/documentation-workspace";
import { fetchDocumentation } from "@/lib/server-api";

export default async function DocumentationPage() {
  const documents = await fetchDocumentation();

  return <DocumentationWorkspace documents={documents} />;
}
