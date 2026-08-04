import type { SVGProps } from "react";

export const UncheckedIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="m4.5 12.5 4 4L19.5 6" />
    <path d="M4 4 20 20" />
  </svg>
);
