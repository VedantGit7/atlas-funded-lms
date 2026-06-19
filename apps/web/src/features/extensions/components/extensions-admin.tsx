"use client";

import { useState } from "react";
import {
  formatExtensionsApiError,
  extensionsApi,
  type ExtensionPointDto,
  type ExtensionRegistrationDto,
} from "../api";

type ExtensionsAdminProps = {
  extensionPoints: ExtensionPointDto[];
  registrations: ExtensionRegistrationDto[];
};

export function ExtensionsAdmin({ extensionPoints, registrations }: ExtensionsAdminProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [extensionPointKey, setExtensionPointKey] = useState(
    extensionPoints[0]?.key ?? "item_type_renderer",
  );
  const [registrationKey, setRegistrationKey] = useState("swipe-renderer");
  const [configJson, setConfigJson] = useState('{"rendererKey":"swipe"}');

  async function onCreateRegistration() {
    setPending(true);
    setError(null);

    try {
      await extensionsApi.createExtensionRegistration({
        extensionPointKey,
        registrationKey,
        configJson: JSON.parse(configJson) as Record<string, unknown>,
        status: "ACTIVE",
      });
      window.location.reload();
    } catch (err) {
      setError(formatExtensionsApiError(err));
    } finally {
      setPending(false);
    }
  }

  async function onDeleteRegistration(id: string) {
    if (!window.confirm("Delete this extension registration?")) return;

    setPending(true);
    setError(null);

    try {
      await extensionsApi.deleteExtensionRegistration({ id });
      window.location.reload();
    } catch (err) {
      setError(formatExtensionsApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div role="alert" className="rounded border p-3 text-sm">
          {error}
        </div>
      ) : null}

      <section className="space-y-3 rounded border p-4">
        <h2 className="font-medium">Extension points</h2>
        <ul className="space-y-2 text-sm">
          {extensionPoints.map((point) => (
            <li key={point.id} className="flex justify-between gap-4">
              <span>{point.key}</span>
              <span>{point.pointType}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded border p-4">
        <h2 className="font-medium">Create registration</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm">Extension point</span>
            <select
              value={extensionPointKey}
              onChange={(event) => {
                setExtensionPointKey(event.target.value);
              }}
              className="w-full rounded border p-2"
            >
              {extensionPoints.map((point) => (
                <option key={point.id} value={point.key}>
                  {point.key}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm">Registration key</span>
            <input
              value={registrationKey}
              onChange={(event) => {
                setRegistrationKey(event.target.value);
              }}
              className="w-full rounded border p-2"
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm">Config JSON</span>
          <textarea
            value={configJson}
            onChange={(event) => {
              setConfigJson(event.target.value);
            }}
            rows={4}
            className="w-full rounded border p-2 font-mono text-sm"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            void onCreateRegistration();
          }}
        >
          Register extension
        </button>
      </section>

      <section className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3">Point</th>
              <th className="p-3">Registration</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => (
              <tr key={registration.id} className="border-b">
                <td className="p-3">{registration.extensionPointKey}</td>
                <td className="p-3">{registration.registrationKey}</td>
                <td className="p-3">{registration.status}</td>
                <td className="p-3">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      void onDeleteRegistration(registration.id);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
