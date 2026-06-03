'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/industry', label: 'Industry' },
  { href: '/planner', label: 'Release Planner' },
  { href: '/films', label: 'Film Lookup' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="topbar">
      <span className="brand">Slate Setter</span>
      <div className="tabs">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`tab${pathname.startsWith(href) ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
