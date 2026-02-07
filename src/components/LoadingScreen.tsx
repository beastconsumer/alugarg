export function LoadingScreen({ message = 'Carregando...' }: { message?: string }) {
  return (
    <main className="screen center-screen">
      <div className="loader" />
      <p className="muted">{message}</p>
    </main>
  );
}

