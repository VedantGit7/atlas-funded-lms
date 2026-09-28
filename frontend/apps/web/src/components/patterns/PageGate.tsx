import type { ReactNode } from "react";
import { EmptyState } from "@atlas/design-system/components/empty-state";

type PageGateState = "ready" | "denied" | "not_found" | "error";

type PageGateProps = {
  state: PageGateState;
  title: string;
  deniedMessage?: string;
  notFoundMessage?: string;
  errorMessage?: string;
  children?: ReactNode;
};

export function PageGate({
  state,
  title,
  deniedMessage = "You do not have access to this page.",
  notFoundMessage = "The requested resource was not found or access is denied.",
  errorMessage = "Something went wrong while loading this page.",
  children,
}: PageGateProps) {
  if (state === "denied") {
    return (
      <main className="p-6" role="alert">
        <EmptyState title={title} description={deniedMessage} />
      </main>
    );
  }

  if (state === "not_found") {
    return (
      <main className="p-6" role="alert">
        <EmptyState title={title} description={notFoundMessage} />
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="p-6" role="alert">
        <EmptyState title={title} description={errorMessage} />
      </main>
    );
  }

  return <>{children}</>;
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </header>
  );
}
