import type { ReactNode } from "react";

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
      <main>
        <h1>{title}</h1>
        <p role="alert">{deniedMessage}</p>
      </main>
    );
  }

  if (state === "not_found") {
    return (
      <main>
        <h1>{title}</h1>
        <p role="alert">{notFoundMessage}</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main>
        <h1>{title}</h1>
        <p role="alert">{errorMessage}</p>
      </main>
    );
  }

  return <>{children}</>;
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-2">
      <h1>{title}</h1>
      {description ? <p className="text-sm opacity-80">{description}</p> : null}
    </header>
  );
}
