type LegalRootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

/** Legal pages ship a full-bleed branded document shell; no PublicSiteShell wrapper. */
export default function LegalRootLayout({ children }: LegalRootLayoutProps) {
  return children;
}
