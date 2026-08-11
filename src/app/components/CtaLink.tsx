import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

// A CTA link that respects where it points. CMS href fields can hold either an
// internal route ("/assessment") or an external URL (e.g. the Medalia patient
// portal). Internal → Next <Link> (fast client nav, same tab). External http(s)
// → plain <a target="_blank"> so it opens in a new tab and doesn't drop the
// current session.
export default function CtaLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}
