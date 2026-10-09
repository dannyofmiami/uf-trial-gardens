import type { Metadata } from 'next';
import { PageHeader, Section } from '@/components/Ui';
import AdminPanel from '@/components/admin/AdminPanel';

export const metadata: Metadata = {
  title: 'Site admin',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <PageHeader eyebrow="Site admin" title="Manage the site" lede="Sign in to update the announcement banner on the home page." />
      <Section>
        <AdminPanel />
      </Section>
    </>
  );
}
