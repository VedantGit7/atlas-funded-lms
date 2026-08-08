"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { clientApi, toast } from "../../../lib/client-api";

type PracticeItem = { itemId: string; stem: string; itemTypeKey: string };
type ItemsResponse = { data: { items: PracticeItem[] } };

type DeckEditorDialogProps = {
  deckId: string | null;
  deckTitle: string;
  onClose: () => void;
  onChanged: () => void;
};

const TYPE_LABEL: Record<string, string> = {
  swipe: "Swipe",
  matching: "Match",
  mcq_single: "Multiple choice",
  true_false: "True / False",
};

function TypeChip({ itemTypeKey }: { itemTypeKey: string }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
      {TYPE_LABEL[itemTypeKey] ?? itemTypeKey}
    </span>
  );
}

/** Curate items into a learner-owned deck. Ownership is enforced server-side. */
export function DeckEditorDialog({ deckId, deckTitle, onClose, onChanged }: DeckEditorDialogProps) {
  const headingId = useId();
  const searchId = useId();
  const [deckItems, setDeckItems] = useState<PracticeItem[]>([]);
  const [results, setResults] = useState<PracticeItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const loadDeckItems = useCallback(async () => {
    if (!deckId) return;
    try {
      const res = await clientApi.get<ItemsResponse>(`/api/v1/me/decks/${deckId}/items`);
      setDeckItems(res.data.items);
    } catch {
      setDeckItems([]);
    }
  }, [deckId]);

  const search = useCallback(async (term: string) => {
    try {
      const suffix = term.trim() ? `?q=${encodeURIComponent(term.trim())}` : "";
      const res = await clientApi.get<ItemsResponse>(`/api/v1/me/practice-items${suffix}`);
      setResults(res.data.items);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (!deckId) return;
    setLoading(true);
    void (async () => {
      await Promise.all([loadDeckItems(), search("")]);
      setLoading(false);
    })();
  }, [deckId, loadDeckItems, search]);

  // Debounce the browse query so typing does not hammer the API.
  useEffect(() => {
    if (!deckId) return;
    const id = window.setTimeout(() => {
      void search(query);
    }, 300);
    return () => {
      window.clearTimeout(id);
    };
  }, [query, deckId, search]);

  useEffect(() => {
    if (!deckId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [deckId, onClose]);

  if (!deckId) return null;

  const inDeck = new Set(deckItems.map((item) => item.itemId));

  async function addItem(itemId: string) {
    setBusyItemId(itemId);
    try {
      await clientApi.post(`/api/v1/me/decks/${deckId ?? ""}/items`, { itemId }, "deck-add-item");
      await loadDeckItems();
      onChanged();
    } catch {
      toast.error("Could not add that item.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(itemId: string) {
    setBusyItemId(itemId);
    try {
      await clientApi.delete(`/api/v1/me/decks/${deckId ?? ""}/items?itemId=${itemId}`, "deck-remove-item");
      await loadDeckItems();
      onChanged();
    } catch {
      toast.error("Could not remove that item.");
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <h2 id={headingId} className="text-lg font-bold text-foreground">
          {deckTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add cards to practise. {deckItems.length} in this deck.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading deck...
          </div>
        ) : (
          <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden md:grid-cols-2">
            {/* In this deck */}
            <section className="flex min-h-0 flex-col">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                In this deck
              </h3>
              {deckItems.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No cards yet. Add some from the right.
                </p>
              ) : (
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {deckItems.map((item) => (
                    <li
                      key={item.itemId}
                      className="flex items-start gap-2 rounded-xl border border-border bg-background p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm text-foreground">{item.stem || "Untitled card"}</p>
                        <TypeChip itemTypeKey={item.itemTypeKey} />
                      </div>
                      <button
                        type="button"
                        aria-label="Remove from deck"
                        disabled={busyItemId === item.itemId}
                        onClick={() => void removeItem(item.itemId)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-[var(--destructive)] disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Browse */}
            <section className="flex min-h-0 flex-col">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Add cards
              </h3>
              <div className="relative mb-2">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id={searchId}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                  placeholder="Search cards..."
                  aria-label="Search cards to add"
                  className="h-9 w-full rounded-full border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              {results.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No cards found. Your academy has not published practice cards yet.
                </p>
              ) : (
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {results.map((item) => {
                    const added = inDeck.has(item.itemId);
                    return (
                      <li
                        key={item.itemId}
                        className="flex items-start gap-2 rounded-xl border border-border bg-background p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm text-foreground">{item.stem || "Untitled card"}</p>
                          <TypeChip itemTypeKey={item.itemTypeKey} />
                        </div>
                        <button
                          type="button"
                          aria-label={added ? "Already in deck" : "Add to deck"}
                          disabled={added || busyItemId === item.itemId}
                          onClick={() => void addItem(item.itemId)}
                          className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
