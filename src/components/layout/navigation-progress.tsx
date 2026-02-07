"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const prevPathname = React.useRef(pathname);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (pathname !== prevPathname.current) {
      // Navigation completed — finish the bar
      setProgress(100);
      setIsNavigating(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);

      timerRef.current = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 300);

      prevPathname.current = pathname;
    }
  }, [pathname]);

  // Intercept link clicks to start the progress bar
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.getAttribute("target") === "_blank") return;
      if (href === pathname) return;

      // Start progress
      setIsNavigating(true);
      setProgress(15);

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 90;
          }
          // Slow down as it progresses
          const increment = prev < 50 ? 8 : prev < 80 ? 3 : 1;
          return Math.min(prev + increment, 90);
        });
      }, 150);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  if (!isNavigating && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none">
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)]"
        style={{
          width: `${progress}%`,
          transition: progress === 100
            ? "width 200ms ease-out"
            : progress === 0
              ? "none"
              : "width 400ms ease",
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: progress === 100 ? "width, opacity" : "width",
          transitionDuration: progress === 100 ? "200ms, 300ms" : "400ms",
          transitionDelay: progress === 100 ? "0ms, 100ms" : "0ms",
        }}
      />
    </div>
  );
}
