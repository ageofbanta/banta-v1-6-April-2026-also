'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'banta_posts';
const AUTHOR_KEY = 'banta_author';

export default function ComposeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const stationFromQuery = searchParams.get('station') || 'sen';

  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [stationId, setStationId] = useState(stationFromQuery);

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY);
    if (saved) setAuthor(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem(AUTHOR_KEY, author);
  }, [author]);

  function handleSubmit() {
    if (!text.trim()) return;

    const newPost = {
      id: Date.now().toString(),
      author,
      text,
      topic,
      stationId,
      createdAt: Date.now(),
      likes: 0,
      comments: [],
    };

    const raw = localStorage.getItem(STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : [];

    const updated = [newPost, ...existing];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    router.push('/feed');
  }

  return (
    <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Compose</h1>

      <div style={{ marginTop: 20 }}>
        <label>Your display name</label>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          style={{ width: '100%', padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <label>Station</label>
        <select
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          style={{ width: '100%', padding: 10, marginTop: 6 }}
        >
          <option value="sen">SEN</option>
          <option value="abc774">ABC 774</option>
          <option value="triplej">Triple J</option>
          <option value="3aw">3AW</option>
        </select>
      </div>

      <div style={{ marginTop: 20 }}>
        <label>Topic</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          style={{ width: '100%', padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <label>Your message</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          style={{ width: '100%', padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button
          onClick={handleSubmit}
          style={{
            padding: '12px 16px',
            background: '#111',
            color: '#fff',
            borderRadius: 8,
            border: 'none',
            fontWeight: 600,
          }}
        >
          Post message
        </button>

        <button
          onClick={() => router.push('/feed')}
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #ddd',
            background: '#fff',
          }}
        >
          Back to Feed
        </button>
      </div>
    </main>
  );
}
