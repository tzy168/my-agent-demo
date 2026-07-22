import Docs from "@/components/Docs";

type DocsPageProps = {
  searchParams: Promise<{ doc?: string }>;
};

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const { doc } = await searchParams;
  return <Docs doc={doc} />;
}
