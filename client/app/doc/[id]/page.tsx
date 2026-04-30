import Editor from './Editor';

interface PageProps {
  params: { id: string };
}

export default function DocPage({ params }: PageProps) {
  return <Editor docId={params.id} />;
}
