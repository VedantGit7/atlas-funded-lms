type LocaleResource = {
  locale: string;
  key: string;
  value: string;
};

type LocalePickerProps = {
  resources: LocaleResource[];
};

export function LocalePicker({ resources }: LocalePickerProps) {
  const locales = [...new Set(resources.map((resource) => resource.locale))].sort();

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-semibold">Locale</h2>
      <p className="mt-1 text-sm opacity-80">Available locale packs configured for this academy.</p>
      {locales.length === 0 ? (
        <p className="mt-3 text-sm opacity-80">No locale resources are configured yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {locales.map((locale) => (
            <li key={locale} className="rounded border px-3 py-2">
              {locale}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
