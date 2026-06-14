import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { ChatPanel } from "@/components/ChatPanel";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  head: () => ({ meta: [{ title: "Chat — souqss" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { id } = Route.useParams();
  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <div className="hidden md:block">
        <Header />
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden md:px-4 md:py-4">
        <div className="flex min-h-0 flex-1 overflow-hidden bg-card md:rounded-xl md:border md:shadow-sm">
          <ChatPanel conversationId={id} backTo="/messages" />
        </div>
      </main>
    </div>
  );
}