'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  getSupabaseUserId,
  getTestIdentities,
  initialiseBackendIdentity,
  loadPosts,
  savePosts,
  saveTestIdentities,
  setBackendAwareAuthor,
  setCurrentAuthor,
  setSupabasePreferredAuthor,
  STATION_NAMES,
  type PostItem,
} from '../lib/banta';

const STATION_IDS = Object.keys(STATION_NAMES);

export default function ComposeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const stationFromQuery = searchParams.get('station') || 'sen';
  const topicFromQuery = searchParams.get('topic') || '';

  const initialStation = STATION_IDS.includes(stationFromQuery)
    ? stationFromQuery
    : 'sen';

  const [mounted, setMounted] = useState(false);
  const [author, setAuthor] = useState('Peter T');
  const [savedAuthors, setSavedAuthors] = useState<string[]>([]);
  const [stationId, setStationId] = useState(initialStation);
  const [topic, setTopic] = useState(topicFromQuery);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function bootIdentity() {
      const identity = await initialiseBackendIdentity();
      const identities = getTestIdentities();

      if (cancelled) return;

      setAuthor(identity.author);
      setSavedAuthors(identities);
      setMounted(true);
    }

    bootIdentity();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const nextStation = searchParams.get('station') || 'sen';
    if (STATION_IDS.includes(nextStation)) {
      setStationId(nextStation);
    }

    const nextTopic = searchParams.get('topic') || '';
    setTopic(nextTopic);
  }, [searchParams]);

  function handleAuthorChange(value: string) {
    setAuthor(value);

    const trimmed = value.trim();
    if (!trimmed) return;

    setCurrentAuthor(trimmed);
    setSupabasePreferredAuthor(trimmed);
  }

  function handleChooseAuthor(name: string) {
    setAuthor(name);
    setCurrentAuthor(name);
    setSupabasePreferredAuthor(name);
  }

  async function handleSaveCurrentAuthor() {
    const trimmed = author.trim();
    if (!trimmed) return;

    const next = Array.from(
      new Set([
        trimmed,
        ...savedAuthors.map((name) => name.trim()).filter(Boolean),
      ])
    );

    saveTestIdentities(next);
    setSavedAuthors(next);

    const finalAuthor = await setBackendAwareAuthor(trimmed);
    setAuthor(finalAuthor);
  }

  const stationLabel = useMemo(() => {
    return STATION_NAMES[stationId] ?? 'Unknown station';
  }, [stationId]);

  const recentTopicsForStation = useMemo(() => {
    const posts = loadPosts();

    const topics = posts
      .filter(
        (post) =>
          post.stationId === stationId && post.topic && post.topic.trim()
      )
      .map((post) => post.topic!.trim());

    return Array.from(new Set(topics)).slice(0, 5);
  }, [stationId, mounted]);

  async function insertPostIntoSupabase(post: PostItem, authorName: string) {
    try {
      const userId = await getSupabaseUserId();

      const { error } = await supabase.from('posts').insert({
        id: post.id,
        author_id: userId,
        author_name: authorName,
        station_id: post.stationId,
        topic: post.topic || null,
        body: post.text,
        created_at: post.createdAt,
        likes_count: post.likes || 0,
      });

      if (error) {
        console.warn(
          'Supabase post insert failed. Local save still succeeded.',
          error
        );
        return false;
      }

      return true;
    } catch (err) {
      console.warn(
        'Supabase post insert failed. Local save still succeeded.',
        err
      );
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedAuthor = author.trim();
    const trimmedText = text.trim();
    const trimmedTopic = topic.trim();

    if (!trimmedAuthor) {
      setError('Please enter your name.');
      return;
    }

    if (!trimmedText) {
      setError('Please enter a message.');
      return;
    }

    const finalAuthor = await setBackendAwareAuthor(trimmedAuthor);

    const currentPosts = loadPosts();

    const newPost: PostItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      stationId,
      author: finalAuthor,
      text: trimmedText,
      createdAt: Date.now(),
      likes: 0,
      topic: trimmedTopic,
      comments: [],
    };

    const updated = [newPost, ...currentPosts];
    savePosts(updated);

    await insertPostIntoSupabase(newPost, finalAuthor);

    const nextAuthors = Array.from(
      new Set([
        finalAuthor,
        ...savedAuthors.map((name) => name.trim()).filter(Boolean),
      ])
    );
    saveTestIdentities(nextAuthors);
    setSavedAuthors(nextAuthors);
    setAuthor(finalAuthor);

    router.push('/feed');
  }

  if (!mounted) {
    return (
      <main
        style={{
          padding: 20,
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <p>Loading compose…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 20,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Link href="/feed" style={{ textDecoration: 'none' }}>
          ← Back to Feed
        </Link>
      </div>

      <h1 style={{ margin: '0 0 8px 0', fontSize: 30 }}>Compose</h1>

      <p style={{ opacity: 0.75, lineHeight: 1.45, marginBottom: 20 }}>
        Post as a user. Topic is secondary. Station is contextual.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 16,
          background: '#fff',
          display: 'grid',
          gap: 14,
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Your name
          </label>

          <input
            value={author}
            onChange={(e) => handleAuthorChange(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: '100%',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 16,
            }}
          />

          <div
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}
          >
            {savedAuthors.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleChooseAuthor(name)}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 999,
                  padding: '6px 10px',
                  background: author.trim() === name ? '#111' : '#fff',
                  color: author.trim() === name ? '#fff' : '#111',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {name}
              </button>
            ))}

            <button
              type="button"
              onClick={handleSaveCurrentAuthor}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: 999,
                padding: '6px 10px',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Save current name
            </button>
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Station
          </label>

          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            style={{
              width: '100%',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 16,
              background: '#fff',
            }}
          >
            {STATION_IDS.map((id) => (
              <option key={id} value={id}>
                {STATION_NAMES[id]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Topic
          </label>

          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. AFL, Housing, Cost of living"
            style={{
              width: '100%',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 16,
            }}
          />

          {recentTopicsForStation.length > 0 ? (
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 10,
              }}
            >
              {recentTopicsForStation.map((suggestedTopic) => (
                <button
                  key={suggestedTopic}
                  type="button"
                  onClick={() => setTopic(suggestedTopic)}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: 999,
                    padding: '6px 10px',
                    background:
                      topic.trim() === suggestedTopic ? '#111' : '#fff',
                    color: topic.trim() === suggestedTopic ? '#fff' : '#111',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {suggestedTopic}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Your message
          </label>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Write your message for ${stationLabel}`}
            rows={6}
            style={{
              width: '100%',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '12px',
              fontSize: 16,
              resize: 'vertical',
            }}
          />
        </div>

        {error ? (
          <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 999,
              padding: '10px 14px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            Submit to Feed
          </button>

          <Link
            href="/feed"
            style={{
              textDecoration: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 999,
              padding: '10px 14px',
              color: 'inherit',
              fontSize: 15,
            }}
          >
            Back to Feed
          </Link>
        </div>
      </form>
    </main>
  );
}
