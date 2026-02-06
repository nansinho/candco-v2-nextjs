"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value: controlledValue,
  defaultValue,
  onChange,
  name,
  id,
  placeholder = "Sélectionner une date",
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const dateString = controlledValue ?? internalValue;

  const date = React.useMemo(() => {
    if (!dateString) return undefined;
    const parsed = parse(dateString, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [dateString]);

  const handleSelect = (selected: Date | undefined) => {
    const val = selected ? format(selected, "yyyy-MM-dd") : "";
    if (controlledValue === undefined) {
      setInternalValue(val);
    }
    onChange?.(val);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (controlledValue === undefined) {
      setInternalValue("");
    }
    onChange?.("");
  };

  return (
    <>
      {name && (
        <input type="hidden" name={name} value={dateString} />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start border-border/60 bg-transparent px-3 text-left text-[13px] font-normal",
              !date && "text-muted-foreground/50",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground/50" />
            {date ? (
              <span className="flex-1">
                {format(date, "dd MMMM yyyy", { locale: fr })}
              </span>
            ) : (
              <span className="flex-1">{placeholder}</span>
            )}
            {date && (
              <X
                className="ml-auto h-3.5 w-3.5 text-muted-foreground/50 hover:text-foreground transition-colors"
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            defaultMonth={date}
            captionLayout="dropdown"
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
