"use client";

import Form from "next/form";
import { type ReactNode, useEffect, useRef } from "react";
import type { CatalogFilters } from "../domain/catalog";

/**
 * Keep only URL synchronization, debouncing and the filter panel's
 * dismissal in the client bundle. Buttons inside opt in with
 * `data-catalog="clear-q"` (empty the search) or `"close"` (close the panel).
 */
export function CatalogForm({
  filters,
  basePath,
  children,
}: {
  filters: CatalogFilters;
  basePath: string;
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

  // The filter panel floats over the list: a click outside or Escape closes it.
  useEffect(() => {
    const openPanel = () =>
      formRef.current?.querySelector<HTMLDetailsElement>("details[open]");
    const onPointer = (event: PointerEvent) => {
      const panel = openPanel();
      if (panel && !panel.contains(event.target as Node)) panel.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      const panel = openPanel();
      if (event.key !== "Escape" || !panel) return;
      panel.open = false;
      panel.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <Form
      ref={formRef}
      action={basePath}
      prefetch={false}
      scroll={false}
      role="search"
      className="flex flex-col gap-3"
      onSubmit={() => clearTimeout(timer.current)}
      onClick={(event) => {
        const button = (event.target as Element).closest("[data-catalog]");
        const action = button?.getAttribute("data-catalog");
        if (action === "close") {
          const panel = button?.closest("details");
          if (panel) panel.open = false;
          panel?.querySelector("summary")?.focus();
        } else if (action === "clear-q") {
          const q = formRef.current?.elements.namedItem("q");
          if (!(q instanceof HTMLInputElement)) return;
          q.value = "";
          q.focus();
          clearTimeout(timer.current);
          formRef.current?.requestSubmit();
        }
      }}
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
