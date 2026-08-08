"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
  manageStatusChipClassName,
} from "../manage/manage-ui-shared";
import {
  WHATSAPP_LIST_HREF,
  type TemplateDto,
  type WhatsappHeaderType,
} from "./whatsapp-shared";

type TemplatesResponse = { data: { items: TemplateDto[] } };
type TemplateResponse = { data: TemplateDto };

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-[var(--admin-on-surface)]";

function statusTone(status: TemplateDto["status"]): "success" | "primary" | "neutral" | "danger" {
  if (status === "APPROVED") return "success";
  if (status === "PENDING") return "primary";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

export function WhatsappTemplatesPanel() {
  const [items, setItems] = useState<TemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [headerType, setHeaderType] = useState<WhatsappHeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<TemplatesResponse>(
        "/api/v1/marketing/whatsapp/templates",
      );
      setItems(response.data.items);
    } catch (caught) {
      setItems([]);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load templates.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setName("");
    setHeaderType("NONE");
    setHeaderText("");
    setHeaderImageUrl("");
    setBody("");
    setFooter("");
    setButtonText("");
    setButtonUrl("");
  }

  async function createTemplate() {
    const trimmedName = name.trim();
    if (!trimmedName || !/^[a-z0-9_]+$/.test(trimmedName)) {
      toast.error("Template name must be lowercase letters, numbers, and underscores.");
      return;
    }
    if (!body.trim()) {
      toast.error("Body is required.");
      return;
    }
    if (headerType === "TEXT" && !headerText.trim()) {
      toast.error("Header text is required for TEXT header type.");
      return;
    }
    if (headerType === "IMAGE" && !headerImageUrl.trim()) {
      toast.error("Image URL is required for IMAGE header type.");
      return;
    }

    const buttons =
      buttonText.trim().length > 0
        ? [
            buttonUrl.trim()
              ? { type: "URL" as const, text: buttonText.trim(), url: buttonUrl.trim() }
              : { type: "QUICK_REPLY" as const, text: buttonText.trim() },
          ]
        : [];

    setBusy(true);
    try {
      await clientApi.post<TemplateResponse>(
        "/api/v1/marketing/whatsapp/templates",
        {
          name: trimmedName,
          category: "MARKETING",
          headerType,
          headerText: headerType === "TEXT" ? headerText.trim() : null,
          headerImageUrl: headerType === "IMAGE" ? headerImageUrl.trim() : null,
          body: body.trim(),
          footer: footer.trim() || null,
          buttons,
        },
        "whatsapp-template-create",
      );
      toast.success("Template created.");
      resetForm();
      setShowCreate(false);
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not create template.",
      );
    } finally {
      setBusy(false);
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
          <h1 className={managePageTitleClassName}>WhatsApp Templates</h1>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            Create and manage message templates. Mock mode auto-approves templates for testing.
          </p>
        </div>
        {!showCreate ? (
          <button
            type="button"
            className={`${managePrimaryButtonClassName} shrink-0`}
            onClick={() => {
              setShowCreate(true);
            }}
          >
            Create template
          </button>
        ) : (
          <button
            type="button"
            className={`${manageSecondaryButtonClassName} shrink-0`}
            onClick={() => {
              setShowCreate(false);
              resetForm();
            }}
          >
            Back to list
          </button>
        )}
      </header>

      {showCreate ? (
        <section className="max-w-xl space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
          <h2 className="text-base font-bold text-[var(--admin-on-surface)]">New template</h2>
          <label className="block">
            <span className={LABEL_CLASS}>Name</span>
            <input
              type="text"
              value={name}
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
              }}
              className={FIELD_CLASS}
              placeholder="welcome_offer"
            />
            <span className="mt-1 block text-xs text-[var(--admin-on-surface-variant)]">
              Lowercase letters, numbers, and underscores only.
            </span>
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Header type</span>
            <select
              value={headerType}
              disabled={busy}
              onChange={(event) => {
                setHeaderType(event.target.value as WhatsappHeaderType);
              }}
              className={FIELD_CLASS}
            >
              <option value="NONE">None</option>
              <option value="TEXT">Text</option>
              <option value="IMAGE">Image</option>
            </select>
          </label>
          {headerType === "TEXT" ? (
            <label className="block">
              <span className={LABEL_CLASS}>Header text</span>
              <input
                type="text"
                value={headerText}
                maxLength={60}
                disabled={busy}
                onChange={(event) => {
                  setHeaderText(event.target.value);
                }}
                className={FIELD_CLASS}
              />
            </label>
          ) : null}
          {headerType === "IMAGE" ? (
            <label className="block">
              <span className={LABEL_CLASS}>Header image URL</span>
              <input
                type="url"
                value={headerImageUrl}
                disabled={busy}
                onChange={(event) => {
                  setHeaderImageUrl(event.target.value);
                }}
                className={FIELD_CLASS}
                placeholder="https://…"
              />
            </label>
          ) : null}
          <label className="block">
            <span className={LABEL_CLASS}>Body</span>
            <textarea
              value={body}
              maxLength={1024}
              rows={5}
              disabled={busy}
              onChange={(event) => {
                setBody(event.target.value);
              }}
              className={FIELD_CLASS}
              placeholder="Hello {{1}}, check out our latest offer!"
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Footer (optional)</span>
            <input
              type="text"
              value={footer}
              maxLength={60}
              disabled={busy}
              onChange={(event) => {
                setFooter(event.target.value);
              }}
              className={FIELD_CLASS}
            />
          </label>
          <fieldset className="space-y-3 rounded-lg border border-[var(--admin-border)] p-4">
            <legend className="px-1 text-sm font-medium text-[var(--admin-on-surface)]">
              Optional button
            </legend>
            <label className="block">
              <span className={LABEL_CLASS}>Button text</span>
              <input
                type="text"
                value={buttonText}
                maxLength={25}
                disabled={busy}
                onChange={(event) => {
                  setButtonText(event.target.value);
                }}
                className={FIELD_CLASS}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Button URL (optional — URL button if set)</span>
              <input
                type="url"
                value={buttonUrl}
                disabled={busy}
                onChange={(event) => {
                  setButtonUrl(event.target.value);
                }}
                className={FIELD_CLASS}
                placeholder="https://…"
              />
            </label>
          </fieldset>
          <button
            type="button"
            disabled={busy}
            className={managePrimaryButtonClassName}
            onClick={() => {
              void createTemplate();
            }}
          >
            Create template
          </button>
        </section>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-[var(--admin-on-surface-variant)]">
          Loading templates…
        </p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No templates yet. Create your first template to get started.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Category
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Body
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                    <td className="px-4 py-3 font-semibold text-[var(--admin-on-surface)]">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {row.category}
                    </td>
                    <td className="px-4 py-3">
                      <span className={manageStatusChipClassName(statusTone(row.status))}>
                        {row.status}
                      </span>
                    </td>
                    <td className="max-w-md truncate px-4 py-3 text-[var(--admin-on-surface-variant)]">
                      {row.body}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
