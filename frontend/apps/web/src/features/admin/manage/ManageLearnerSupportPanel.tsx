"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
  type Conversation,
  type Message,
} from "../domain/admin-domain-api";
import {
  managePrimaryButtonClassName,
  manageSearchInputClassName,
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
  manageTableCardClassName,
  manageTableHeadClassName,
  manageTableTdClassName,
  manageTableThClassName,
} from "./manage-ui-shared";

function formatError(error: unknown): string {
  return error instanceof ClientApiError ? error.message : "Request failed.";
}

export function ManageLearnerSupportPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [inboxQuery, setInboxQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchConversations();
      setConversations(response.data.items);
    } catch (caught) {
      setError(formatError(caught));
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const response = await fetchConversationMessages(conversationId);
      setMessages(response.data.items);
    } catch (caught) {
      setError(formatError(caught));
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [selectedId, loadMessages]);

  const filteredConversations = conversations.filter((conversation) => {
    const normalized = inboxQuery.trim().toLowerCase();
    if (!normalized) return true;
    const subject = (conversation.subject ?? "").toLowerCase();
    const id = conversation.id.toLowerCase();
    return subject.includes(normalized) || id.includes(normalized);
  });

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !messageBody.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendConversationMessage(selectedId, messageBody.trim());
      setMessageBody("");
      await loadMessages(selectedId);
      await loadConversations();
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedConversation = conversations.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        <section className={`${manageTableCardClassName} flex flex-col`}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Inbox</h2>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                void loadConversations();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>

          <div className="border-b border-[var(--admin-border)] px-3 py-2">
            <input
              type="search"
              value={inboxQuery}
              onChange={(event) => {
                setInboxQuery(event.target.value);
              }}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className={manageSearchInputClassName}
            />
          </div>

          <div className="max-h-[28rem] flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-6 text-sm text-[var(--admin-on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading…
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="px-2 py-6 text-sm text-[var(--admin-on-surface-variant)]">
                {inboxQuery.trim() ? "No conversations match your search." : "No conversations yet."}
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredConversations.map((conversation) => {
                  const active = selectedId === conversation.id;
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(conversation.id);
                        }}
                        className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] ${
                          active
                            ? "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-on-surface)]"
                            : "hover:bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)]"
                        }`}
                      >
                        <span className="block truncate text-sm font-semibold">
                          {conversation.subject ?? `Conversation ${conversation.id.slice(0, 8)}`}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
                          <span>{conversation.messageCount} messages</span>
                          <span className={manageStatusChipClassName("neutral")}>{conversation.status}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className={`${manageTableCardClassName} flex flex-col`}>
          <div className="border-b border-[var(--admin-border)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
              {selectedConversation?.subject ?? "Thread"}
            </h2>
            {selectedConversation ? (
              <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                Updated {new Date(selectedConversation.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          {!selectedId ? (
            <p className="px-4 py-10 text-sm text-[var(--admin-on-surface-variant)]">
              Select a conversation to view messages and reply.
            </p>
          ) : loadingMessages ? (
            <div className="flex items-center gap-2 px-4 py-10 text-sm text-[var(--admin-on-surface-variant)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading messages…
            </div>
          ) : (
            <>
              <div className="max-h-80 flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-[var(--admin-on-surface-variant)]">No messages yet.</p>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className={manageTableHeadClassName}>
                        <th className={manageTableThClassName}>Sent</th>
                        <th className={manageTableThClassName}>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messages.map((message) => (
                        <tr key={message.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                          <td className={`${manageTableTdClassName} whitespace-nowrap align-top`}>
                            {new Date(message.sentAt).toLocaleString()}
                          </td>
                          <td className={`${manageTableTdClassName} align-top`}>{message.body}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <form
                className="space-y-3 border-t border-[var(--admin-border)] px-4 py-4"
                onSubmit={(event) => {
                  void handleSend(event);
                }}
              >
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                    Reply as staff
                  </span>
                  <textarea
                    value={messageBody}
                    onChange={(event) => {
                      setMessageBody(event.target.value);
                    }}
                    required
                    rows={4}
                    className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                  />
                </label>
                <button type="submit" disabled={submitting} className={managePrimaryButtonClassName}>
                  {submitting ? "Sending…" : "Send message"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
