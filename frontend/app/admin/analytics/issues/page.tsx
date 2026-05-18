import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export default function Page() {
  return (
    <AnalyticsDashboard
      focus="issues"
      title="Issue Resolution Rates"
      description="Operational issue volume, open workload, and resolution performance."
    />
  );
}
