import AdminProgressReview from '@/components/AdminProgressReview';

export default function Page() {
  return (
    <AdminProgressReview
      pageTitle="Academic & Activity Updates"
      pageDescription="Review periodic academic and student activity submissions from residents."
      defaultTrack="all"
      allowTrackSelection
    />
  );
}
