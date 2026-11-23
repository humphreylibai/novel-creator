export function StagePlaceholder({ title, reason }: { title: string; reason: string }) {
  return (
    <div style={{ padding: 32, color: '#a8a29a' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#57534e' }}>{title}</h2>
      <p style={{ margin: 0 }}>{reason}</p>
    </div>
  );
}
