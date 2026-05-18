import BroadcastComposer from '@/components/BroadcastComposer';

export default function Page() {
  return (
    <div>
      <div className="page-header">
        <h1>Message Parents / Guardians</h1>
        <p>Broadcast parent communication by SMS, email, or both</p>
      </div>
      <BroadcastComposer defaultAudience="parents" />
    </div>
  );
}
