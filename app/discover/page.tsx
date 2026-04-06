'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const STATION_NAMES: Record<string, string> = {
  sen: 'SEN',
  abc774: 'ABC 774',
  triplej: 'Triple J',
  '3aw': '3AW',
};

type Comment = {
  id: string;
  postId: string;
  parentId: string | null;
  author: string;
  text: string;
  createdAt: number;
  likes: number;
};

type Post = {
  id: string;
  stationId: string;
  author: string;
  text: string;
  createdAt: number;
  likes: number;
  topic?: string;
  context?: string;
  comments: Comment[];
};

type TopicSummary = {
  topic: string;
  postCount: number;
  totalLikes: number;
  totalReplies: number;
  latestPostAt: number;
  stations: string[];
  authors: string[];
  score: number;
};

type SortMode = 'trending' | 'latest' | 'posts' | 'cross';

function loadPosts(): Post[] {
  try {
    const raw = localStorage.getItem('banta_posts');
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((p: any) => ({
      id: String(p.id),
      stationId: String(p.stationId ?? ''),
      author: String(p.author ?? 'anonymous'),
      text: String(p.text ?? ''),
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      likes: typeof p.likes === 'number' ? p.likes : 0,
      topic:
        typeof p.topic === 'string'
          ? p.topic
          : typeof p.context === 'string'
          ? p.context
          : '',
      context: typeof p.context === 'string' ? p.context : '',
      comments: Array.isArray(p.comments)
        ? p.comments.map((c: any) => ({
            id: String(c.id),
            postId: String(c.postId),
            parentId:
              c.parentId === null || typeof c.parentId === 'string'
                ? c.parentId
                : null,
            author: String(c.author ?? 'anonymous'),
            text: String(c.text ?? ''),
            createdAt:
              typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
            likes: typeof c.likes === 'number' ? c.likes : 0,
          }))
        : [],
    }));
  } catch {
    return [];
  }
}

function getCommentCount(post: Post) {
  return (post.comments ?? []).filter((c) => c.parentId === null).length;
}

function getTopic(post: Post) {
  return (post.topic || post.context || '').trim();
}

function formatTopic(topic: string) {
  return topic.startsWith('#') ? topic : `#${topic}`;
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const m = 60 * 1000;
  const h = 60 * m;
  const d = 24 * h;

  if (diff < m) return 'just now';
  if (diff < h) return `${Math.floor(diff / m)}m ago`;
  if (diff < d) return `${Math.floor(diff / h)}h ago`;
  return `${Math.floor(diff / d)}d ago`;
}

function buildTopics(posts: Post[]): TopicSummary[] {
  const map = new Map<string, TopicSummary>();

  for (const post of posts) {
    const topic = getTopic(post);
    if (!topic) continue;

    const existing = map.get(topic);

    if (!existing) {
      map.set(topic, {
        topic,
        postCount: 1,
        totalLikes: post.likes,
        totalReplies: getCommentCount(post),
        latestPostAt: post.createdAt,
        stations: [post.stationId],
        authors: [post.author],
        score: 0,
      });
      continue;
    }

    existing.postCount += 1;
    existing.totalLikes += post.likes;
    existing.totalReplies += getCommentCount(post);
    existing.latestPostAt = Math.max(existing.latestPostAt, post.createdAt);

    if (!existing.stations.includes(post.stationId)) {
      existing.stations.push(post.stationId);
    }

    if (!existing.authors.includes(post.author)) {
      existing.authors.push(post.author);
    }
  }

  return Array.from(map.values()).map((t) => ({
    ...t,
    score:
      t.postCount * 4 +
      t.totalReplies * 3 +
      t.totalLikes * 2 +
      t.stations.length * 5,
  }));
}

function sortTopics(topics: TopicSummary[], mode: SortMode) {
  const copy = [...topics];

  if (mode === 'latest') {
    return copy.sort((a, b) => b.latestPostAt - a.latestPostAt);
  }

  if (mode === 'posts') {
    return copy.sort((a, b) => {
      if (b.postCount !== a.postCount) return b.postCount - a.postCount;
      return b.latestPostAt - a.latestPostAt;
    });
  }

  if (mode === 'cross') {
    return copy.sort((a, b) => {
      if (b.stations.length !== a.stations.length) {
        return b.stations.length - a.stations.length;
      }
      if (b.postCount !== a.postCount) return b.postCount - a.postCount;
      return b.latestPostAt - a.latestPostAt;
    });
  }

  return copy.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.latestPostAt - a.latestPostAt;
  });
}

export default function DiscoverPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('trending');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = () => setPosts(loadPosts());
    load();

    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  const topics = useMemo(() => buildTopics(posts), [posts]);

  const filteredTopics = useMemo(() => {
    const sorted = sortTopics(topics, sortMode);
    const q = query.trim().toLowerCase();

    if (!q) return sorted;

    return sorted.filter((t) => {
      const topicMatch = t.topic.toLowerCase().includes(q);
      const authorMatch = t.authors.some((a) => a.toLowerCase().includes(q));
      const stationMatch = t.stations.some((s) =>
        (STATION_NAMES[s] ?? s).toLowerCase().includes(q)
      );

      return topicMatch || authorMatch || stationMatch;
    });
  }, [topics, sortMode, query]);

  const stats = useMemo(() => {
    return {
      totalTopics: topics.length,
      crossStation: topics.filter((t) => t.stations.length > 1).length,
      activeToday: topics.filter(
        (t) => Date.now() - t.latestPostAt < 24 * 60 * 60 * 1000
      ).length,
    };
  }, [topics]);

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 860,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Link href="/feed" style={{ textDecoration: 'none' }}>
          ← Back to Feed
        </Link>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 30 }}>Discover</h1>
        <div style={{ opacity: 0.72, lineHeight: 1.45, maxWidth: 720 }}>
          Topic-first discovery. User is still primary. Topic is how people
          browse what the audience is talking about.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 14,
            background: '#fff',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>
            Topics
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {stats.totalTopics}
          </div>
        </div>

        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 14,
            background: '#fff',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>
            Cross-station topics
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {stats.crossStation}
          </div>
        </div>

        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 14,
            padding: 14,
            background: '#fff',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>
            Active in last 24h
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {stats.activeToday}
          </div>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 14,
          background: '#fff',
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics, stations, or authors"
            style={{
              flex: '1 1 260px',
              minWidth: 220,
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
            }}
          />

          <Link
            href="/compose"
            style={{
              textDecoration: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 999,
              padding: '10px 12px',
              color: 'inherit',
              fontSize: 14,
              whiteSpace: 'nowrap',
            }}
          >
            + New message
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSortMode('trending')}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 999,
              padding: '8px 12px',
              background: sortMode === 'trending' ? '#f3f4f6' : '#fff',
              cursor: 'pointer',
            }}
          >
            Trending
          </button>

          <button
            onClick={() => setSortMode('latest')}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 999,
              padding: '8px 12px',
              background: sortMode === 'latest' ? '#f3f4f6' : '#fff',
              cursor: 'pointer',
            }}
          >
            Latest
          </button>

          <button
            onClick={() => setSortMode('posts')}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 999,
              padding: '8px 12px',
              background: sortMode === 'posts' ? '#f3f4f6' : '#fff',
              cursor: 'pointer',
            }}
          >
            Most posts
          </button>

          <button
            onClick={() => setSortMode('cross')}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 999,
              padding: '8px 12px',
              background: sortMode === 'cross' ? '#f3f4f6' : '#fff',
              cursor: 'pointer',
            }}
          >
            Cross-station
          </button>
        </div>
      </div>

      {filteredTopics.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No topics found.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredTopics.map((t) => (
            <article
              key={t.topic}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 14,
                background: '#fff',
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <Link
                  href={`/topic/${encodeURIComponent(t.topic)}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  {formatTopic(t.topic)}
                </Link>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  fontSize: 13,
                  opacity: 0.8,
                  marginBottom: 12,
                }}
              >
                <span>{t.postCount} posts</span>
                <span>{t.totalReplies} replies</span>
                <span>{t.totalLikes} likes</span>
                <span>{t.stations.length} stations</span>
                <span>{relativeTime(t.latestPostAt)}</span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 6 }}>
                  Active on
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {t.stations.map((stationId) => (
                    <Link
                      key={stationId}
                      href={`/station/${encodeURIComponent(stationId)}`}
                      style={{
                        textDecoration: 'none',
                        border: '1px solid #d1d5db',
                        borderRadius: 999,
                        padding: '6px 10px',
                        color: 'inherit',
                        fontSize: 13,
                      }}
                    >
                      {STATION_NAMES[stationId] ?? stationId}
                    </Link>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link
                  href={`/topic/${encodeURIComponent(t.topic)}`}
                  style={{
                    textDecoration: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 999,
                    padding: '8px 12px',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                >
                  Open topic
                </Link>

                <Link
                  href={`/compose?topic=${encodeURIComponent(t.topic)}`}
                  style={{
                    textDecoration: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 999,
                    padding: '8px 12px',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                >
                  Post on this topic
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
