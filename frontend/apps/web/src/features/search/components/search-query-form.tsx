"use client";

import type { SubmitEvent } from "react";

type SearchQueryFormProps = {
  initialQuery: string;
  initialType?: string;
};

function readFormValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export function SearchQueryForm({ initialQuery, initialType }: SearchQueryFormProps) {
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const q = readFormValue(formData.get("q")).trim();
    const type = readFormValue(formData.get("type")).trim();

    if (q.length >= 2) {
      params.set("q", q);
    }
    if (type) {
      params.set("type", type);
    }

    const query = params.toString();
    window.location.assign(query.length > 0 ? `/search?${query}` : "/search");
  }

  return (
    <form className="flex flex-col gap-3 rounded-lg border p-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        <span>Search</span>
        <input
          name="q"
          type="search"
          defaultValue={initialQuery}
          placeholder="Search courses, posts, and certificates"
          minLength={2}
          className="rounded border px-3 py-2"
          aria-label="Search query"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Type</span>
        <select name="type" defaultValue={initialType ?? ""} className="rounded border px-3 py-2">
          <option value="">All types</option>
          <option value="course">Courses</option>
          <option value="post">Posts</option>
          <option value="certificate">Certificates</option>
        </select>
      </label>
      <button type="submit" className="w-fit rounded border px-4 py-2 text-sm font-medium">
        Search
      </button>
    </form>
  );
}
