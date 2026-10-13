import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';

/** Placeholder for Home (D11), replaced by its screen bead: the app name and a link to each screen. */
export function HomePage() {
  const { t } = useI18n();
  const links = [
    { to: '/practice', label: t.common.nav.practice },
    { to: '/exam', label: t.common.nav.exam },
    { to: '/progress', label: t.common.nav.progress },
    { to: '/settings', label: t.common.nav.settings },
    { to: '/flagged', label: t.common.nav.flagged },
  ];
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t.home.title}</h1>
      <nav className="flex flex-col gap-2">
        {links.map(({ to, label }) => (
          <Link key={to} to={to} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
