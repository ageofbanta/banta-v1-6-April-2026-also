'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

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
  sharedFromPostId?: string;
  sharedBy?: string;
};

type SortMode = 'latest' | 'top';

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
      sharedFromPostId:
        typeof p.sharedFromPostId === 'string' ? p.sharedFromPostId : undefined,
      sharedBy: typeof p.sharedBy === 'string' ? p.sharedBy : undefined,
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

function sortPosts(posts: Post[], mode: SortMode) {
  const copy = [...posts];

  if (mode === 'top') {
    return copy.sort((a, b) => {
      const scoreA = a.likes + getCommentCount(a) * 2;
      const scoreB = b.likes + getCommentCount(b) * 2;

      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.createdAt - a.createdAt;
    });
  }

  return copy.sort((a, b) => b.createdAt - a.createdAt);
}

export default function TopicPage() {
  const params = useParams();
  const slug = decodeURIComponent(String(params?.slug ?? ''));

  const [posts, setPosts] = useState<Post[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('latest');

  useEffect(() => {
    const load = () => setPosts(loadPosts());
    load();

    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  const topicPosts = useMemo(() => {
    return posts.filter(
      (post) => getTopic(post).toLowerCase() === slug.toLowerCase()
    );
  }, [posts, slug]);

  const sortedPosts = useMemo(() => {
    return sortPosts(topicPosts, sortMode);
  }, [topicPosts, sortMode]);

  const stationCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const post of topicPosts) {
      counts.set(post.stationId, (counts.get(post.stationId) || 0) + 1);
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [topicPosts]);

  const totalReplies = useMemo(() => {
    return topicPosts.reduce((sum, post) => sum + getCommentCount(post), 0);
  }, [topicPosts]);

  const totalLikes = useMemo(() => {
    return topicPosts.reduce((sum, post) => sum + post.likes, 0);
  }, [topicPosts]);

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
        <Link href="/discover" style={{ textDecoration: 'none' }}>
          ← Back to Discover
        </Link>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 30 }}>
          {formatTopic(slug)}
        </h1>
        <div style={{ opacity: 0.72, lineHeight: 1.45 }}>
          Topic page. User first. Topic second. Station contextual only.
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
            Posts
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {topicPosts.length}
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
            Replies
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalReplies}</div>
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
            Likes
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totalLikes}</div>
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
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
          Active on
        </div>

        {stationCounts.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No stations yet.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {stationCounts.map(([stationId, count]) => (
              <Link
                key={stationId}
                href={`/station/${encodeURIComponent(stationId)}`}
                style={{
                  textDecoration: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: 999,
                  padding: '8px 12px',
                  color: 'inherit',
                  fontSize: 14,
                }}
              >
                {STATION_NAMES[stationId] ?? stationId} · {count}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <Link
          href={`/compose?topic=${encodeURIComponent(slug)}`}
          style={{
            textDecoration: 'none',
            border: '1px solid #d1d5db',
            borderRadius: 999,
            padding: '10px 14px',
            color: 'inherit',
            fontSize: 14,
          }}
        >
          Post on this topic
        </Link>

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
          onClick={() => setSortMode('top')}
          style={{
            border: '1px solid #d1d5db',
            borderRadius: 999,
            padding: '8px 12px',
            background: sortMode === 'top' ? '#f3f4f6' : '#fff',
            cursor: 'pointer',
          }}
        >
          Top
        </button>
      </div>

      {sortedPosts.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No posts yet for this topic.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sortedPosts.map((post) => (
            <article
              key={post.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 14,
                background: '#fff',
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <Link
                  href={`/u/${encodeURIComponent(post.author)}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {post.author}
                </Link>
              </div>

              <div
                style={{
                  fontSize: 16,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  marginBottom: 12,
                }}
              >
                {post.text}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                <span>{STATION_NAMES[post.stationId] ?? post.stationId}</span>
                <span>👍 {post.likes}</span>
                <Link
                  href={`/post/${encodeURIComponent(post.id)}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  💬 {getCommentCount(post)}
                </Link>
                <span>{relativeTime(post.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
