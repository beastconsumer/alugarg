import { ReactNode } from 'react';

export function ErrorScreen({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <main className="screen center-screen">
      <section className="card narrow-card">
        <h1>{title}</h1>
        <p className="muted">{message}</p>
        {action}
      </section>
    </main>
  );
}

