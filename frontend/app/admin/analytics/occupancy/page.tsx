import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export default function Page() {
  return (
    <AnalyticsDashboard
      focus="occupancy"
      title="Room Occupancy Stats"
      description="Building, room capacity, and assignment coverage across the selected section."
    />
  );
}
