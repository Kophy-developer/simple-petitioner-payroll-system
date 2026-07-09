import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { getUserName, roleCategories } from "@/lib/demo-data";

export default async function RoleCategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cat = roleCategories.find((c) => c.id === id);
  if (!cat) return <p className="py-20 text-center">Category not found.</p>;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configuration" title={cat.name} description={cat.description} actions={<Link href="/role-categories" className="text-sm text-civic-navy hover:underline">Back</Link>} />
      <Card><CardBody className="space-y-3">
        {cat.memberIds.map((mid) => (
          <div key={mid} className="flex items-center justify-between rounded-xl border border-ink/10 px-4 py-3 text-sm">
            <span>{getUserName(mid)}</span>
            <button type="button" className="text-danger hover:underline">Remove</button>
          </div>
        ))}
        <Link href="/admin" className="inline-block text-sm text-civic-navy hover:underline">Add member via user search</Link>
      </CardBody></Card>
    </div>
  );
}
