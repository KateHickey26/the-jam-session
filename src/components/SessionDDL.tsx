"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
};

export default function SessionDDL({
  value,
  onChange,
  options,
  className,
  placeholder = "Session…",
  loading = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const display = editing ? query : value;

  const items = React.useMemo(() => {
    if (!editing || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, editing, query]);

  function openMenu() {
    if (disabled) return;
    setEditing(true);
    setOpen(true);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  function closeMenu() {
    setEditing(false);
    setOpen(false);
    setQuery("");
  }

  function handleFocus() {
    openMenu();
  }
  function handleBlur() {
    // allow option click before closing
    requestAnimationFrame(closeMenu);
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    }
  }
  function pick(opt: string) {
    onChange(opt);
    setQuery(opt);
    closeMenu();
  }

  // click-outside to close
  React.useEffect(() => {
    if (!open) return;
    function handleDocMouseDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleDocMouseDown);
    return () => document.removeEventListener("mousedown", handleDocMouseDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={display}
        placeholder={placeholder}
        clearable={false}               // hide built-in clear button
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        disabled={disabled}
        // toggle menu on click (prevent text selection)
        onMouseDown={(e) => {
          if (!open) e.preventDefault();
          open ? closeMenu() : openMenu();
        }}
        className="pr-16"              // room for ✕ and chevron
      />

      {/* Right adornments: ✕ then chevron */}
      <div className="absolute inset-y-0 right-2 flex items-center gap-2">
        {/* Custom clear button: only while searching */}
        {open && editing && query && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()} // keep focus, don't close
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="rounded-md p-0.5 text-muted-foreground hover:bg-accent/10"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Chevron — now clickable */}
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <button
            type="button"
            aria-label={open ? "Close sessions menu" : "Open sessions menu"}
            onMouseDown={(e) => {
              e.preventDefault(); // avoid input blur
              open ? closeMenu() : openMenu();
            }}
            className="p-1"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </button>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-md"
          role="listbox"
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
          ) : (
            items.map((opt) => (
              <div
                key={opt}
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault(); // pick before blur
                  pick(opt);
                }}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-accent/10"
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}