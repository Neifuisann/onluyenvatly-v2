"use client";

import Form from "next/form";
import { type ReactNode, useEffect, useRef } from "react";
import type { CatalogFilters } from "../domain/catalog";

/** Keep only URL synchronization and debouncing in the client bundle. */
export function CatalogForm({
  filters,
  children,
}: {
  filters: CatalogFilters;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    clearTimeout(timer.current);
    const values = {
      q: filters.q ?? "",
      chapter: filters.chapter ?? "",
      tag: filters.tag ?? "",
      sort: filters.sort === "order" ? "" : filters.sort,
    };
    for (const [name, value] of Object.entries(values)) {
      const field = formRef.current?.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement
      )
        field.value = value;
    }
  }, [filters.q, filters.chapter, filters.tag, filters.sort]);

  return (
    <Form
      ref={formRef}
      action="/lessons"
      prefetch={false}
      scroll={false}
      role="search"
      className="flex flex-col gap-3"
      onSubmit={() => clearTimeout(timer.current)}
      onChange={(event) => {
        const field = event.target;
        const search = field instanceof HTMLInputElement && field.name === "q";
        if (!search && !(field instanceof HTMLSelectElement)) return;
        clearTimeout(timer.current);
        timer.current = setTimeout(
          () => formRef.current?.requestSubmit(),
          search ? 400 : 0,
        );
      }}
    >
      {children}
    </Form>
  );
}
