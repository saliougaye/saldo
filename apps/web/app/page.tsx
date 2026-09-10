import { APP_VERSION } from '../src/server/version';

export default function Home() {
  return (
    <main style={{ padding: 32, textAlign: 'center', maxWidth: 480 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' }}>
        Saldo server is running
      </h1>
      <p style={{ color: '#8C8C8C' }}>Version {APP_VERSION}</p>
      <p style={{ color: '#8C8C8C' }}>
        <a href="https://github.com/saldo-app/saldo" style={{ color: '#C7C7C7' }}>
          Source and documentation
        </a>
      </p>
    </main>
  );
}
