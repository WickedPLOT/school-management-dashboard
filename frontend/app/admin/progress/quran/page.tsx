import AdminProgressReview from '@/components/AdminProgressReview';

export default function Page() {
  return (
    <AdminProgressReview
      pageTitle="Religious Progress"
      pageDescription="Review Qur'an and religious development updates submitted by students."
      defaultTrack="religious"
    />
  );
}
