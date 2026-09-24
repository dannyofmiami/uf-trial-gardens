import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cultivars, getCultivar, getEvaluations, meta } from '@/lib/data';
import CultivarDetail from '@/components/CultivarDetail';

type Params = { id: string };

// makes one page per cultivar
export function generateStaticParams(): Params[] {
  return cultivars.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const c = getCultivar(id);
  if (!c) return {};
  return {
    title: `${c.name} (${c.genus})`,
    description: `Trial performance for ${c.name} (${c.genus}), supplied by ${c.supplier ?? 'an unrecorded supplier'}. ${c.evaluationCount} evaluations at the UF/IFAS Public Trial Gardens, Homestead, FL.`,
  };
}

export default async function CultivarPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const c = getCultivar(id);
  if (!c) notFound();

  const evals = getEvaluations(id);

  return <CultivarDetail c={c} evals={evals} meta={meta} />;
}
