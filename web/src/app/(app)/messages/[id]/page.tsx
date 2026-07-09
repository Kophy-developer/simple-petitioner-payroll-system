"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Lock, Phone, Video } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { conversations } from "@/lib/demo-data";

const demoMessages = [
  { id: "m-1", sender: "Sam Rivera", text: "Turn-in for NV batch is ready for review.", time: "9:12 AM" },
  { id: "m-2", sender: "You", text: "Uploading validity sheet this afternoon.", time: "9:18 AM", own: true },
  { id: "m-3", sender: "Alex Whitfield", text: "Benchmark stays at 75% for this drive.", time: "10:02 AM" },
];

export default function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const convo = conversations.find((c) => c.id === id);
  const [draft, setDraft] = useState("");
  if (!convo) return <p className="py-20 text-center">Conversation not found.</p>;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <PageHeader eyebrow="Messaging" title={convo.name} description="End-to-end encrypted"
        actions={
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-success" />
            <Button variant="ghost" size="sm"><Phone size={16} /></Button>
            <Button variant="ghost" size="sm"><Video size={16} /></Button>
            <Link href="/messages" className="text-sm text-civic-navy hover:underline">All chats</Link>
          </div>
        }
      />
      <Card className="flex flex-1 flex-col overflow-hidden"><CardBody className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {demoMessages.map((m) => (
          <div key={m.id} className={`flex ${m.own ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-md rounded-2xl px-4 py-3 text-sm ${m.own ? "bg-civic-navy text-parchment" : "bg-white border border-ink/10 text-ink"}`}>
              {!m.own ? <p className="mb-1 text-xs font-medium opacity-70">{m.sender}</p> : null}
              <p>{m.text}</p>
              <p className="mt-1 text-[10px] opacity-60">{m.time}</p>
            </div>
          </div>
        ))}
      </CardBody>
        <form className="flex gap-2 border-t border-ink/10 p-4" onSubmit={(e) => { e.preventDefault(); setDraft(""); }}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Encrypted message…" />
          <Button type="submit">Send</Button>
        </form>
      </Card>
    </div>
  );
}
