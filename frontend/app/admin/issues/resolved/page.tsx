import AdminIssueBoard from '@/components/AdminIssueBoard';

export default function Page() {
  return (
    <AdminIssueBoard
      statusFilter="resolved"
      title="Resolved Issues"
      description="Review completed issue reports and keep a visible resolution history for students."
    />
  );
}
