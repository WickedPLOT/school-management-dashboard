import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export default function Page() {
  return (
    <AnalyticsDashboard
      focus="engagement"
      title="Engagement Trends"
      description="Attendance, progress review, and communication reach across the platform."
    />
  );
}
