import BroadcastComposer from '@/components/BroadcastComposer';

export default function Page() {
  return (
    <div>
      <div className="page-header">
        <h1>Message Students</h1>
        <p>Broadcast system messages by SMS, email, or both</p>
      </div>
      <BroadcastComposer defaultAudience="students" />
    </div>
  );
}
