import type { HTMLAttributes } from "react";

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cx(
        "rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/70 backdrop-blur dark-dashboard:border-white/10 dark-dashboard:bg-slate-900/70 dark-dashboard:shadow-black/20",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("border-b border-slate-200/80 px-5 py-4 dark-dashboard:border-white/10", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cx("text-base font-semibold text-slate-950", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("px-5 py-5", className)} {...props} />;
}
