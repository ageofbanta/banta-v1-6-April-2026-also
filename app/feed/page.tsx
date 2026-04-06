'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  addNotification,
  getCommentCount,
  getUnreadNotificationCount,
  initialiseBackendIdentity,
  isFollowing,
  loadPosts,
  loadSupabasePosts,
  PostItem,
  savePosts,
  sortPosts,
  formatTimeAgo,
  STATION_NAMES,
} from '../lib/banta';

type SortMode = 'smart' | 'newest' | 'top';

const FLAGGED_POSTS_KEY = 'banta_flagged_posts';
const HIDDEN_POSTS_KEY = 'banta_hidden_posts';
const REPORTED_POSTS_KEY = 'banta_reported_posts';

function loadIdList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveIdList(key: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))));
}

function toggleId(key: string, id: string) {
  const current = new Set(loadIdList(key));
  if (current.has(id)) current.delete(id);
  else current.add(id);
  saveIdList(key, Array.from(current));
}

function mergeSupabaseAndLocalPosts(
  supabasePosts: PostItem[],
  localPosts: PostItem[]
): PostItem[] {
  const localMap = new Map(localPosts.map((post) => [post.id, post]));
  const merged: PostItem[] = [];

  for (const supabasePost of supabasePosts) {
    const localMatch = localMap.get(supabasePost.id);

    merged.push({
      ...supabasePost,
      likes: localMatch?.likes ?? supabasePost.likes ?? 0,
      comments: localMatch?.comments ?? [],
      topic: localMatch?.topic || supabasePost.topic || '',
      sharedFromPostId: localMatch?.sharedFromPostId,
      sharedFromStationId: localMatch?.sharedFromStationId,
    });

    localMap.delete(supabasePost.id);
  }

  for (const remainingLocal of Array.from(localMap.values())) {
    merged.push(remainingLocal);
  }

  return merged;
}

export default function FeedPage() {
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [author, setAuthor] = useState('Peter T');
  const [sortMode, setSortMode] = useState<SortMode>('smart');
  const [followingOnly, setFollowingOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [reportedIds, setReportedIds] = useState<string[]>([]);
  const [showFlagged, setShowFlagged] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [showReported, setShowReported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const identity = await initialiseBackendIdentity();
      if (cancelled) return;

      const current = identity.author;
      const localPosts = loadPosts();

      setAuthor(current);
      setUnreadCount(getUnreadNotificationCount(current));
      setFlaggedIds(loadIdList(FLAGGED_POSTS_KEY));
      setHiddenIds(loadIdList(HIDDEN_POSTS_KEY));
      setReportedIds(loadIdList(REPORTED_POSTS_KEY));

      try {
        const supabasePosts = await loadSupabasePosts();

        if (!cancelled && supabasePosts.length > 0) {
          setPosts(mergeSupabaseAndLocalPosts(supabasePosts, localPosts));
          return;
        }

        if (!cancelled) {
          setPosts(localPosts);
        }
      } catch {
        if (!cancelled) {
          setPosts(localPosts);
        }
      }
    };

    refresh().then(() => {
      if (!cancelled) setMounted(true);
    });

    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const visiblePosts = useMemo(() => {
    let working = [...posts];

    if (followingOnly) {
      working = working.filter((post) => isFollowing(author, post.author));
    }

    if (!showFlagged) {
      working = working.filter((post) => !flaggedIds.includes(post.id));
    }

    if (!showHidden) {
      working = working.filter((post) => !hiddenIds.includes(post.id));
    }

    if (!showReported) {
      working = working.filter((post) => !reportedIds.includes(post.id));
    }

    return sortPosts(working, sortMode);
  }, [
    posts,
    sortMode,
    followingOnly,
    author,
    flaggedIds,
    hiddenIds,
    reportedIds,
    showFlagged,
    showHidden,
    showReported,
  ]);

  function likePost(postId: string) {
    const localPosts = loadPosts();
    const localMatch = localPosts.find((post) => post.id === postId);
    const fallbackPost = posts.find((post) => post.id === postId);

    if (!localMatch && !fallbackPost) return;

    const basePost = localMatch || {
      ...fallbackPost!,
      comments: fallbackPost?.comments || [],
      likes: fallbackPost?.likes || 0,
    };

    const nextPosts = [
      {
        ...basePost,
        likes: (basePost.likes || 0) + 1,
      },
      ...localPosts.filter((post) => post.id !== postId),
    ];

    savePosts(nextPosts);

    const nextMerged = posts.map((post) =>
      post.id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post
    );

    setPosts(nextMerged);

    if (basePost.author && basePost.author !== author) {
      addNotification({
        type: 'like',
        toUser: basePost.author,
        fromUser: author,
        postId: basePost.id,
        text: 'liked your post',
      });
    }
  }

  function handleToggleFlag(postId: string) {
    toggleId(FLAGGED_POSTS_KEY, postId);
    setFlaggedIds(loadIdList(FLAGGED_POSTS_KEY));
  }

  function handleToggleHide(postId: string) {
    toggleId(HIDDEN_POSTS_KEY, postId);
    setHiddenIds(loadIdList(HIDDEN_POSTS_KEY));
  }

  function handleReport(postId: string) {
    toggleId(REPORTED_POSTS_KEY, postId);
    setReportedIds(loadIdList(REPORTED_POSTS_KEY));
  }

  if (!mounted) {
    return <main style={{ padding: 24 }}>Loading…</main>;
  }

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Banta</h1>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/compose">+ New post</Link>
          <Link href="/people">People</Link>
          <Link href="/activity">
            Activity{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Link>
          <Link href={`/u/${encodeURIComponent(author)}`}>Profile</Link>
        </div>
      </div>

      <div style={{ marginTop: 10, color: '#666' }}>
        Posting as <strong>{author}</strong>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 16,
        }}
      >
        <button onClick={() => setSortMode('smart')}>
          {sortMode === 'smart' ? 'Smart ✓' : 'Smart'}
        </button>

        <button onClick={() => setSortMode('newest')}>
          {sortMode === 'newest' ? 'New ✓' : 'New'}
        </button>

        <button onClick={() => setSortMode('top')}>
          {sortMode === 'top' ? 'Top ✓' : 'Top'}
        </button>

        <button onClick={() => setFollowingOnly((v) => !v)}>
          {followingOnly ? 'Following ✓' : 'Following'}
        </button>

        <button onClick={() => setShowFlagged((v) => !v)}>
          Flagged ({flaggedIds.length})
        </button>

        <button onClick={() => setShowHidden((v) => !v)}>
          Hidden ({hiddenIds.length})
        </button>

        <button onClick={() => setShowReported((v) => !v)}>
          Reported ({reportedIds.length})
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {visiblePosts.length === 0 && (
          <div style={{ color: '#666' }}>No posts yet</div>
        )}

        {visiblePosts.map((post) => {
          const isReported = reportedIds.includes(post.id);

          return (
            <article
              key={post.id}
              style={{
                marginBottom: 20,
                border: '1px solid #ddd',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <strong>
                  <Link
                    href={`/u/${encodeURIComponent(post.author)}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {post.author}
                  </Link>
                </strong>

                <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                  {post.topic ? (
                    <>
                      <Link
                        href={`/topic/${encodeURIComponent(post.topic)}`}
                        style={{ color: 'inherit' }}
                      >
                        {post.topic}
                      </Link>
                      {' • '}
                    </>
                  ) : null}

                  {post.stationId ? (
                    <>
                      via {STATION_NAMES[post.stationId] || post.stationId}
                      {' • '}
                    </>
                  ) : null}

                  {formatTimeAgo(post.createdAt)}
                </div>
              </div>

              <div style={{ lineHeight: 1.45 }}>{post.text}</div>

              {isReported && (
                <div style={{ fontSize: 12, color: 'red', marginTop: 6 }}>
                  Reported
                </div>
              )}

              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <button onClick={() => likePost(post.id)}>
                  ❤️ {post.likes || 0}
                </button>

                <Link href={`/post/${post.id}`}>
                  💬 {getCommentCount(post)}
                </Link>

                <button onClick={() => handleToggleFlag(post.id)}>
                  {flaggedIds.includes(post.id) ? 'Unflag' : 'Flag'}
                </button>

                <button onClick={() => handleToggleHide(post.id)}>
                  {hiddenIds.includes(post.id) ? 'Unhide' : 'Hide'}
                </button>

                <button onClick={() => handleReport(post.id)}>
                  {isReported ? 'Unreport' : 'Report'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
