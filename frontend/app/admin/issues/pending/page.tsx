import AdminIssueBoard from '@/components/AdminIssueBoard';

export default function Page() {
  return (
    <AdminIssueBoard
      statusFilter="pending"
      title="Pending Issues"
      description="Review new resident issues, images, and maintenance notes as they come in."
    />
  );
}
