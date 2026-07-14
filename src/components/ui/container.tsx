import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export function Container({ children, className }: ContainerProps) {
  return <div className={["mx-auto w-full max-w-7xl px-6", className].filter(Boolean).join(" ")}>{children}</div>;
}
