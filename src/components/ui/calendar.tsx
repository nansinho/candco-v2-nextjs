"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      locale={fr}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center h-7",
        caption_label: "text-sm font-medium capitalize",
        nav: "flex items-center gap-1",
        button_previous:
          "absolute left-1 top-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-transparent p-0 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 cursor-pointer",
        button_next:
          "absolute right-1 top-0 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-transparent p-0 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 cursor-pointer",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground/60 rounded-md w-9 font-medium text-[0.7rem] uppercase",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-md p-0 font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        selected:
          "[&_.rdp-day_button]:bg-primary [&_.rdp-day_button]:text-primary-foreground [&_.rdp-day_button]:hover:bg-primary [&_.rdp-day_button]:hover:text-primary-foreground [&_.rdp-day_button]:focus:bg-primary [&_.rdp-day_button]:focus:text-primary-foreground",
        today:
          "[&_.rdp-day_button]:bg-accent [&_.rdp-day_button]:text-accent-foreground",
        outside:
          "[&_.rdp-day_button]:text-muted-foreground/30 [&_.rdp-day_button]:hover:text-muted-foreground/50",
        disabled: "[&_.rdp-day_button]:text-muted-foreground/20 [&_.rdp-day_button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
