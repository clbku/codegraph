export function ComingSoonModule({ name, hint }: { name: string; hint: string }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-badge">Coming soon</div>
      <h2>{name}</h2>
      <p>{hint}</p>
    </div>
  );
}
