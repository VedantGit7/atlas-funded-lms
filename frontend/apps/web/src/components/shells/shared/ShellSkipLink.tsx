import Link from "next/link";

export function ShellSkipLink() {
  return (
    <Link
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
    >
      Skip to main content
    </Link>
  );
}
