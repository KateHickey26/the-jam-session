"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
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
        clearable={open && editing}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        disabled={disabled}
        // open/close when the field is clicked (without selecting text)
        onMouseDown={(e) => {
          if (!open) e.preventDefault();
          open ? closeMenu() : openMenu();
        }}
        className={cn(
          // leave a bit more room on the right for both the ✕ and chevron
          "pr-12"
        )}
      />

      {/* Right-side adornment: spinner or chevron; offset so it doesn't overlap the ✕ */}
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
              // push it left a bit to avoid the clear button which sits at right-2
              "mr-4"
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