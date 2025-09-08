"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Show a clear (×) button when there is a value. Defaults to true. */
  clearable?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { className, type = "text", clearable = true, onChange, value, defaultValue, ...props },
  ref
) {
  const innerRef = React.useRef<HTMLInputElement>(null);

  // merge refs
  React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

  const isControlled = value !== undefined;
  const hasValue =
    (isControlled && String(value ?? "").length > 0) ||
    (!isControlled && String(defaultValue ?? innerRef.current?.value ?? "").length > 0);

    function handleClear() {
      const el = innerRef.current;
      if (!el) return;
    
      // Use the native setter so React sees the change
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set;
    
      setter?.call(el, ""); // set value to empty
    
      // Dispatch a real input event so React onChange fires with target.value === ""
      const ev = new Event("input", { bubbles: true });
      el.dispatchEvent(ev);
    
      // Keep focus after clearing
      el.focus();
    }

  return (
    <div className="relative">
      <input
        ref={innerRef}
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        className={cn(
          "flex h-9 w-full rounded-md border bg-background px-3 text-sm outline-hidden",
          // leave space for the clear button when visible
          clearable && hasValue ? "pr-8" : "pr-3",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />

      {clearable && hasValue && (
        <button
          type="button"
          aria-label="Clear"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

Input.displayName = "Input";
export { Input };