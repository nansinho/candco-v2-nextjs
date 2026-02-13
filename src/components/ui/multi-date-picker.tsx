"use client";

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDatesDisplay } from "@/lib/devis-helpers";

interface MultiDatePickerProps {
  value: Date[];
  onChange: (dates: Date[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MultiDatePicker({
  value,
  onChange,
  disabled,
  placeholder = "Sélectionner les dates...",
  className,
}: MultiDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const sorted = React.useMemo(
    () => [...value].sort((a, b) => a.getTime() - b.getTime()),
    [value],
  );

  const displayText = React.useMemo(
    () => formatDatesDisplay(sorted),
    [sorted],
  );

  const handleSelect = (dates: Date[] | undefined) => {
    onChange(dates ?? []);
  };

  const removeDate = (dateToRemove: Date) => {
    onChange(value.filter((d) => d.getTime() !== dateToRemove.getTime()));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start border-border/60 bg-muted px-3 text-left text-sm font-normal",
              !value.length && "text-muted-foreground-subtle",
              className,
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground-subtle" />
            {value.length > 0 ? (
              <span className="flex-1 truncate">{displayText}</span>
            ) : (
              <span className="flex-1">{placeholder}</span>
            )}
            {value.length > 0 && (
              <X
                className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground-subtle hover:text-foreground transition-colors"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="multiple"
            selected={value}
            onSelect={handleSelect}
            defaultMonth={sorted[0]}
          />
        </PopoverContent>
      </Popover>

      {/* Selected dates as removable badges */}
      {sorted.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sorted.map((date) => (
            <span
              key={date.toISOString()}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground border border-border/40"
            >
              {format(date, "d MMM yyyy", { locale: fr })}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeDate(date)}
                  className="ml-0.5 rounded-sm hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
