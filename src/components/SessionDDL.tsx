"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";

type Props = {
  value: string;                         // current session name
  onChange: (v: string) => void;         // switch immediately
  options: string[];                     // sessions user can pick
  className?: string;
  placeholder?: string;
  loading?: boolean;                     // show spinner when true
  disabled?: boolean;                    // optional external disable
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

  // What to show in the input
  const display = editing ? query : value;

  // Filter while typing
  const items = React.useMemo(() => {
    if (!editing || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, editing, query]);

  function openMenu() {
    if (disabled) return;
    setEditing(true);
    setOpen(true);
    setQuery(""); // start fresh
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
    // let click on an item run before blur closes it
    requestAnimationFrame(closeMenu);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    }
  }

  function pick(opt: string) {
    onChange(opt);       // switch immediately
    setQuery(opt);
    closeMenu();
  }

  return (
    <div className={cn("relative", className)}>
      <input
        className={cn(
          "w-full h-9 rounded-md border bg-white px-3 pr-9 text-sm outline-hidden",
          "focus:ring-2 focus:ring-jam-blueberry/30",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
        )}
        value={display}
        placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        disabled={disabled}
        // Click anywhere in the input toggles the menu open
        onMouseDown={(e) => {
          // Prevent text selection when just wanting to open
          if (!open) e.preventDefault();
          open ? closeMenu() : openMenu();
        }}
      />

      {/* Right-side adornment: spinner or chevron */}
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white shadow-md"
          role="listbox"
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matches
            </div>
          ) : (
            items.map((opt) => (
              <div
                key={opt}
                role="option"
                onMouseDown={(e) => {
                  e.preventDefault(); // fire before blur
                  pick(opt);
                }}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-accent"
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