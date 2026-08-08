"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Send } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  formatWhatsappDateTime,
  WHATSAPP_LIST_HREF,
  type ConversationDto,
  type InboxMessage,
} from "./whatsapp-shared";

type ConversationsResponse = { data: { items: ConversationDto[] } };
type ConversationDetailResponse = {
  data: { conversation: ConversationDto; messages: InboxMessage[] };
};

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--admin-on-surface)]";

export function WhatsappInboxPanel() {
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDto | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulateBusy, setSimulateBusy] = useState(false);
  const [simulatePhone, setSimulatePhone] = useState("");
  const [simulateBody, setSimulateBody] = useState("");
  const [simulateName, setSimulateName] = useState("");

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await clientApi.get<ConversationsResponse>(
        "/api/v1/marketing/whatsapp/inbox",
      );
      setConversations(response.data.items);
    } catch (caught) {
      setConversations([]);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load conversations.",
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const response = await clientApi.get<ConversationDetailResponse>(
        `/api/v1/marketing/whatsapp/inbox/${conversationId}`,
      );
      setSelectedConversation(response.data.conversation);
      setMessages(response.data.messages);
    } catch (caught) {
      setMessages([]);
      setSelectedConversation(null);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load messages.",
      );
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  async function sendReply() {
    if (!selectedId) return;
    const trimmed = replyBody.trim();
    if (!trimmed) {
      toast.error("Enter a reply message.");
      return;
    }
    setReplyBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/whatsapp/inbox/${selectedId}`,
        { body: trimmed },
        `whatsapp-inbox-reply-${selectedId}`,
      );
      setReplyBody("");
      await loadMessages(selectedId);
      await loadConversations();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not send reply.");
    } finally {
      setReplyBusy(false);
    }
  }

  async function simulateInbound() {
    if (!simulatePhone.trim() || !simulateBody.trim()) {
      toast.error("Phone and message body are required.");
      return;
    }
    setSimulateBusy(true);
    try {
      await clientApi.post(
        "/api/v1/marketing/whatsapp/inbox",
        {
          waPhone: simulatePhone.trim(),
          body: simulateBody.trim(),
          ...(simulateName.trim() ? { learnerName: simulateName.trim() } : {}),
        },
        "whatsapp-inbox-simulate",
      );
      toast.success("Inbound message simulated.");
      setSimulateOpen(false);
      setSimulatePhone("");
      setSimulateBody("");
      setSimulateName("");
      await loadConversations();
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not simulate inbound message.",
      );
    } finally {
      setSimulateBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href={WHATSAPP_LIST_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to WhatsApp
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className={managePageTitleClassName}>Team Inbox</h1>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            View and reply to WhatsApp conversations from learners.
          </p>
        </div>
        <button
          type="button"
          className={`${manageSecondaryButtonClassName} shrink-0`}
          onClick={() => {
            setSimulateOpen(true);
          }}
        >
          Simulate inbound
        </button>
      </header>

      <div className="grid min-h-[28rem] grid-cols-1 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
        <aside className="border-b border-[var(--admin-border)] lg:border-b-0 lg:border-r">
          {loadingList ? (
            <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">No conversations yet.</p>
          ) : (
            <ul className="max-h-[32rem] overflow-y-auto">
              {conversations.map((conversation) => {
                const active = selectedId === conversation.id;
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(conversation.id);
                      }}
                      className={[
                        "flex w-full flex-col gap-0.5 border-b border-[var(--admin-border)] px-4 py-3 text-left transition-colors",
                        active
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                          : "hover:bg-[var(--admin-surface-high)]",
                      ].join(" ")}
                    >
                      <span className="font-semibold text-[var(--admin-on-surface)]">
                        {conversation.learnerName ?? conversation.waPhone}
                      </span>
                      <span className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                        {conversation.lastMessagePreview ?? "—"}
                      </span>
                      <span className="text-[10px] text-[var(--admin-on-surface-variant)]">
                        {formatWhatsappDateTime(conversation.lastMessageAt)}
                        {conversation.unreadCount > 0
                          ? ` · ${conversation.unreadCount} unread`
                          : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[20rem] flex-col">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--admin-on-surface-variant)]">
              Select a conversation to view messages.
            </div>
          ) : loadingMessages ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--admin-on-surface-variant)]">
              Loading messages…
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--admin-border)] px-4 py-3">
                <p className="font-semibold text-[var(--admin-on-surface)]">
                  {selectedConversation?.learnerName ?? selectedConversation?.waPhone ?? "—"}
                </p>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  {selectedConversation?.waPhone}
                </p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--admin-on-surface-variant)]">
                    No messages in this conversation.
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={[
                        "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                        message.direction === "OUT"
                          ? "ml-auto bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)]",
                      ].join(" ")}
                    >
                      <p>{message.body}</p>
                      <p
                        className={[
                          "mt-1 text-[10px]",
                          message.direction === "OUT"
                            ? "text-[color-mix(in_srgb,var(--admin-on-primary)_70%,transparent)]"
                            : "text-[var(--admin-on-surface-variant)]",
                        ].join(" ")}
                      >
                        {formatWhatsappDateTime(message.createdAt)} · {message.status}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 border-t border-[var(--admin-border)] p-4">
                <input
                  type="text"
                  value={replyBody}
                  disabled={replyBusy}
                  onChange={(event) => {
                    setReplyBody(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendReply();
                    }
                  }}
                  placeholder="Type a reply…"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  disabled={replyBusy || !replyBody.trim()}
                  className={managePrimaryButtonClassName}
                  onClick={() => {
                    void sendReply();
                  }}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {simulateOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close simulate dialog"
            className="absolute inset-0 bg-[var(--admin-scrim)]"
            disabled={simulateBusy}
            onClick={() => {
              if (!simulateBusy) setSimulateOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Simulate inbound message"
            className="relative z-10 w-full max-w-md space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Simulate inbound</h2>
            <label className="block">
              <span className={LABEL_CLASS}>WhatsApp phone</span>
              <input
                type="text"
                value={simulatePhone}
                disabled={simulateBusy}
                onChange={(event) => {
                  setSimulatePhone(event.target.value);
                }}
                className={FIELD_CLASS}
                placeholder="+15551234567"
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Learner name (optional)</span>
              <input
                type="text"
                value={simulateName}
                disabled={simulateBusy}
                onChange={(event) => {
                  setSimulateName(event.target.value);
                }}
                className={FIELD_CLASS}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Message</span>
              <textarea
                value={simulateBody}
                rows={3}
                disabled={simulateBusy}
                onChange={(event) => {
                  setSimulateBody(event.target.value);
                }}
                className={FIELD_CLASS}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={simulateBusy}
                className={manageSecondaryButtonClassName}
                onClick={() => {
                  setSimulateOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={simulateBusy}
                className={managePrimaryButtonClassName}
                onClick={() => {
                  void simulateInbound();
                }}
              >
                Simulate
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
