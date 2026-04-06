'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        padding: 24,
        maxWidth: 720,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Banta</h1>

      <p style={{ marginTop: 0, color: '#666', lineHeight: 1.5 }}>
        See what people are texting radio stations — and join the conversation.
      </p>

      <div
        style={{
          marginTop: 24,
          display: 'grid',
          gap: 12,
        }}
      >
        <Link
          href="/feed"
          style={{
            display: 'block',
            padding: 14,
            border: '1px solid #111',
            borderRadius: 12,
            textDecoration: 'none',
            color: '#fff',
            background: '#111',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          Open Feed
        </Link>

        <Link
          href="/compose"
          style={{
            display: 'block',
            padding: 14,
            border: '1px solid #ddd',
            borderRadius: 12,
            textDecoration: 'none',
            color: '#111',
            background: '#fff',
            textAlign: 'center',
          }}
        >
          Post a message
        </Link>

        <Link
          href="/people"
          style={{
            display: 'block',
            padding: 14,
            border: '1px solid #ddd',
            borderRadius: 12,
            textDecoration: 'none',
            color: '#111',
            background: '#fff',
            textAlign: 'center',
          }}
        >
          Explore people
        </Link>
      </div>

      <div
        style={{
          marginTop: 28,
          padding: 16,
          border: '1px solid #eee',
          borderRadius: 12,
          background: '#fafafa',
        }}
      >
        <strong>How it works</strong>
        <ul style={{ marginTop: 8, paddingLeft: 18, color: '#666' }}>
          <li>Post what you’d text to a radio station</li>
          <li>See what others are saying in real time</li>
          <li>Follow people you find interesting</li>
        </ul>
      </div>
    </main>
  );
}
