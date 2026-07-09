"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUserName, roleCategories } from "@/lib/demo-data";

export default function RoleCategoriesPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configuration" title="Role Categories" description="Group users for messaging and access." actions={<Button onClick={() => setOpen(true)}>New category</Button>} />
      <div className="grid gap-4">
        {roleCategories.map((cat) => (
          <Card key={cat.id}>
            <CardBody className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl text-ink">{cat.name}</h2>
                <p className="mt-1 text-sm text-ink/60">{cat.description}</p>
                <p className="mt-3 text-sm text-ink/70">{cat.memberIds.map(getUserName).join(" · ")}</p>
              </div>
              <Link href={`/role-categories/${cat.id}`} className="text-sm font-medium text-civic-navy hover:underline">Manage members</Link>
            </CardBody>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New role category">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setOpen(false); }}>
          <div className="space-y-2"><Label>Name</Label><Input required /></div>
          <div className="space-y-2"><Label>Description</Label><Input /></div>
          <Button type="submit" className="w-full">Create</Button>
        </form>
      </Modal>
    </div>
  );
}
