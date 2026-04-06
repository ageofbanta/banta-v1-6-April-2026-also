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

type SortMode = 'newest' | 'top';

function loadPostsFromStorage(): Post[] {
  try {
    const raw = localStorage.getItem('banta_posts');
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((post: any) => ({
      id: String(post.id),
      stationId: String(post.stationId ?? ''),
      author: String(post.author ?? 'anonymous'),
      text: String(post.text ?? ''),
      createdAt:
        typeof post.createdAt === 'number' ? post.createdAt : Date.now(),
      likes: typeof post.likes === 'number' ? post.likes : 0,
      topic:
        typeof post.topic === 'string'
          ? post.topic
          : typeof post.context === 'string'
          ? post.context
          : '',
      context: typeof post.context === 'string' ? post.context : '',
      comments: Array.isArray(post.comments)
        ? post.comments.map((comment: any) => ({
            id: String(comment.id),
            postId: String(comment.postId),
            parentId:
              comment.parentId === null || typeof comment.parentId === 'string'
                ? comment.parentId
                : null,
            author: String(comment.author ?? 'anonymous'),
            text: String(comment.text ?? ''),
            createdAt:
              typeof comment.createdAt === 'number'
                ? comment.createdAt
                : Date.now(),
            likes: typeof comment.likes === 'number' ? comment.likes : 0,
          }))
        : [],
      sharedFromPostId:
        typeof post.sharedFromPostId === 'string'
          ? post.sharedFromPostId
          : undefined,
      sharedBy: typeof post.sharedBy === 'string' ? post.sharedBy : undefined,
    }));
  } catch (error) {
    console.error('Failed to load posts from localStorage', error);
    return [];
  }
}

function getCommentCount(post: Post) {
  return (post.comments ?? []).filter((comment) => comment.parentId === null)
    .length;
}

function getTopicValue(post: Post) {
  return (post.topic || post.context || '').trim();
}

function getTopicHref(topic: string) {
  return `/topic/${encodeURIComponent(topic)}`;
}

function formatTopic(topic?: string) {
  if (!topic) return '';
  const trimmed = topic.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function sortPosts(posts: Post[], sortMode: SortMode) {
  const copy = [...posts];

  if (sortMode === 'top') {
    return copy.sort((a, b) => {
      const scoreA = a.likes + getCommentCount(a) * 2;
      const scoreB = b.likes + getCommentCount(b) * 2;

      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.createdAt - a.createdAt;
    });
  }

  return copy.sort((a, b) => b.createdAt - a.createdAt);
}

function formatDate(createdAt: number) {
  try {
    return new Date(createdAt).toLocaleString();
  } catch {
    return '';
  }
}

export default function StationPage() {
  const params = useParams();
  const stationId = String(params?.id ?? '');
  const stationLabel = STATION_NAMES[stationId] ?? stationId ?? 'Station';

  const [posts, setPosts] = useState<Post[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  useEffect(() => {
    const load = () => {
      setPosts(loadPostsFromStorage());
    };

    load();

    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  const stationPosts = useMemo(() => {
    return posts.filter((post) => post.stationId === stationId);
  }, [posts, stationId]);

  const sortedPosts = useMemo(() => {
    return sortPosts(stationPosts, sortMode);
  }, [stationPosts, sortMode]);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const post of stationPosts) {
      const topic = getTopicValue(post);
      if (!topic) continue;
      counts.set(topic, (counts.get(topic) || 0) + 1);
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [stationPosts]);

  const totalReplies = useMemo(() => {
    return stationPosts.reduce((sum, post) => sum + getCommentCount(post), 0);
  }, [stationPosts]);

  const totalLikes = useMemo(() => {
    return stationPosts.reduce((sum, post) => sum + post.likes, 0);
  }, [stationPosts]);

  return (
    <main
      style={{
        padding: 20,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 760,
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Link href="/feed" style={{ textDecoration: 'none' }}>
          ← Back to Feed
        </Link>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 30 }}>{stationLabel}</h1>
        <div style={{ opacity: 0.72, lineHeight: 1.45 }}>
          Station is contextual, not the star. This page is for browsing what is
          being said via {stationLabel}.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <Link
          href={`/compose?station=${encodeURIComponent(stationId)}`}
          style={{
            textDecoration: 'none',
            border: '1px solid #d1d5db',
            borderRadius: 999,
            padding: '8px 12px',
            color: 'inherit',
            background: '#fff',
          }}
        >
          Text {stationLabel}
        </Link>

        <Link
          href="/topics"
          style={{
            textDecoration: 'none',
            border: '1px solid #d1d5db',
            borderRadius: 999,
            padding: '8px 12px',
            color: 'inherit',
            background: '#fff',
          }}
        >
          Browse topics
        </Link>
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
            {stationPosts.length}
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

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 14,
          background: '#fff',
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: '0 0 10px 0', fontSize: 18 }}>
          Top topics on {stationLabel}
        </h2>

        {topicCounts.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No topics yet.</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {topicCounts.slice(0, 12).map(([topic, count]) => (
              <Link
                key={topic}
                href={getTopicHref(topic)}
                style={{
                  textDecoration: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: 999,
                  padding: '8px 12px',
                  color: 'inherit',
                  background: '#fff',
                  fontSize: 14,
                }}
              >
                {formatTopic(topic)} · {count}
              </Link>
            ))}
          </div>
        )}
      </section>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <button
          onClick={() => setSortMode('newest')}
          style={{
            border: '1px solid #d1d5db',
            borderRadius: 999,
            padding: '8px 12px',
            background: sortMode === 'newest' ? '#f3f4f6' : '#fff',
            cursor: 'pointer',
          }}
        >
          Newest
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
        <p style={{ opacity: 0.7 }}>No posts for this station yet.</p>
      ) : (
        sortedPosts.map((post) => {
          const topicValue = getTopicValue(post);
          const topicLabel = formatTopic(topicValue);

          return (
            <article
              key={post.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 14,
                background: '#fff',
                marginTop: 12,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <Link
                  href={`/u/${encodeURIComponent(post.author)}`}
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  {post.author}
                </Link>
              </div>

              {topicLabel ? (
                <div style={{ marginBottom: 10 }}>
                  <Link
                    href={getTopicHref(topicValue)}
                    style={{
                      fontSize: 14,
                      textDecoration: 'none',
                    }}
                  >
                    {topicLabel}
                  </Link>
                </div>
              ) : null}

              <div
                style={{
                  fontSize: 16,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  marginBottom: 14,
                }}
              >
                {post.text}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  fontSize: 14,
                }}
              >
                <span>👍 {post.likes}</span>

                <Link
                  href={`/post/${encodeURIComponent(post.id)}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                >
                  💬 {getCommentCount(post)}
                </Link>

                <span style={{ opacity: 0.65, fontSize: 13 }}>
                  {formatDate(post.createdAt)}
                </span>
              </div>
            </article>
          );
        })
      )}
    </main>
  );
}
