import AdminIssueBoard from '@/components/AdminIssueBoard';

export default function Page() {
  return (
    <AdminIssueBoard
      statusFilter="inprogress"
      title="In Progress Issues"
      description="Manage issues that are currently being worked on and keep student follow-up notes current."
    />
  );
}
