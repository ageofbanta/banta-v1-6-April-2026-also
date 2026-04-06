'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  addNotification,
  formatTimeAgo,
  getUnreadNotificationCount,
  getUserStats,
  initialiseBackendIdentity,
  isFollowing,
  loadFollows,
  loadPosts,
  PostItem,
  saveFollows,
  STATION_NAMES,
  toggleFollow,
} from '../../lib/banta';

type UserReply = {
  id: string;
  postId: string;
  postAuthor: string;
  postTopic?: string;
  postStationId: string;
  author: string;
  text: string;
  createdAt: number;
  likes: number;
  parentId: string | null;
};

export default function ProfilePage({
  params,
}: {
  params: { author: string };
}) {
  const profileAuthor = decodeURIComponent(params.author);

  const [mounted, setMounted] = useState(false);
  const [viewer, setViewer] = useState('Peter T');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [tab, setTab] = useState<'posts' | 'replies'>('posts');

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const identity = await initialiseBackendIdentity();
      if (cancelled) return;

      const current = identity.author;
      setViewer(current);
      setPosts(loadPosts());
      setUnreadCount(getUnreadNotificationCount(current));
      setFollowing(isFollowing(current, profileAuthor));
    };

    refresh().then(() => {
      if (!cancelled) {
        setMounted(true);
      }
    });

    const onFocus = () => {
      refresh();
    };

    const onStorage = () => {
      refresh();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [profileAuthor]);

  const userPosts = useMemo(
    () =>
      posts
        .filter((post) => post.author === profileAuthor)
        .sort((a, b) => b.createdAt - a.createdAt),
    [posts, profileAuthor]
  );

  const userReplies = useMemo(() => {
    const replies: UserReply[] = [];

    for (const post of posts) {
      for (const comment of post.comments) {
        if (comment.author === profileAuthor) {
          replies.push({
            id: comment.id,
            postId: post.id,
            postAuthor: post.author,
            postTopic: post.topic,
            postStationId: post.stationId,
            author: comment.author,
            text: comment.text,
            createdAt: comment.createdAt,
            likes: comment.likes || 0,
            parentId: comment.parentId,
          });
        }
      }
    }

    return replies.sort((a, b) => b.createdAt - a.createdAt);
  }, [posts, profileAuthor]);

  const stats = useMemo(
    () => getUserStats(profileAuthor),
    [posts, profileAuthor]
  );

  const joinedLabel = useMemo(() => {
    const timestamps = [
      ...userPosts.map((post) => post.createdAt),
      ...userReplies.map((reply) => reply.createdAt),
    ];

    if (timestamps.length === 0) return 'New around here';

    const oldest = Math.min(...timestamps);
    return `Active ${formatTimeAgo(oldest)}`;
  }, [userPosts, userReplies]);

  const credibilityLabel = useMemo(() => {
    const totalContributions = stats.posts + stats.replies;

    if (totalContributions >= 10 || stats.followers >= 3) {
      return 'Regular voice';
    }

    if (totalContributions >= 4) {
      return 'Getting active';
    }

    return 'Early contributor';
  }, [stats]);

  const isOwnProfile = viewer === profileAuthor;

  function handleToggleFollow() {
    if (isOwnProfile) return;

    const wasFollowing = isFollowing(viewer, profileAuthor);
    toggleFollow(viewer, profileAuthor);
    setFollowing(!wasFollowing);

    const refreshed = loadFollows();
    saveFollows(refreshed);

    if (!wasFollowing) {
      addNotification({
        type: 'follow',
        toUser: profileAuthor,
        fromUser: viewer,
        text: `${viewer} followed you`,
      });
    }
  }

  if (!mounted) {
    return (
      <main
        style={{
          padding: 24,
          maxWidth: 860,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p>Loading profile…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 860,
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Link href="/feed">← Back to Feed</Link>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/activity">
            Activity{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Link>
          <Link href={`/u/${encodeURIComponent(viewer)}`}>My Profile</Link>
        </div>
      </div>

      <section
        style={{
          marginTop: 16,
          border: '1px solid #ddd',
          borderRadius: 14,
          padding: 18,
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: '#666',
                marginBottom: 6,
              }}
            >
              {isOwnProfile ? 'Your profile' : 'Profile'}
            </div>

            <h1 style={{ marginTop: 0, marginBottom: 8 }}>{profileAuthor}</h1>

            <div
              style={{
                color: '#666',
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span>{joinedLabel}</span>
              <span>•</span>
              <span>{credibilityLabel}</span>
            </div>
          </div>

          {isOwnProfile ? (
            <div
              style={{
                display: 'inline-block',
                border: '1px solid #ddd',
                borderRadius: 999,
                padding: '8px 14px',
                color: '#666',
                background: '#fafafa',
              }}
            >
              This is you
            </div>
          ) : (
            <button
              onClick={handleToggleFollow}
              style={{
                border: '1px solid #111',
                background: following ? '#fff' : '#111',
                color: following ? '#111' : '#fff',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              {following ? 'Following ✓' : 'Follow'}
            </button>
          )}
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: 14,
            color: '#666',
          }}
        >
          Viewing as <strong>{viewer}</strong>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 16,
          }}
        >
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 999,
              padding: '8px 12px',
              background: '#fff',
            }}
          >
            Posts: <strong>{stats.posts}</strong>
          </div>

          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 999,
              padding: '8px 12px',
              background: '#fff',
            }}
          >
            Replies: <strong>{stats.replies}</strong>
          </div>

          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 999,
              padding: '8px 12px',
              background: '#fff',
            }}
          >
            Likes: <strong>{stats.likesReceived}</strong>
          </div>

          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 999,
              padding: '8px 12px',
              background: '#fff',
            }}
          >
            Followers: <strong>{stats.followers}</strong>
          </div>

          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 999,
              padding: '8px 12px',
              background: '#fff',
            }}
          >
            Following: <strong>{stats.following}</strong>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}
        >
          <button
            onClick={() => setTab('posts')}
            style={{
              border: '1px solid #ccc',
              background: tab === 'posts' ? '#111' : '#fff',
              color: tab === 'posts' ? '#fff' : '#111',
              borderRadius: 999,
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            Posts ({userPosts.length})
          </button>

          <button
            onClick={() => setTab('replies')}
            style={{
              border: '1px solid #ccc',
              background: tab === 'replies' ? '#111' : '#fff',
              color: tab === 'replies' ? '#fff' : '#111',
              borderRadius: 999,
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            Replies ({userReplies.length})
          </button>
        </div>

        {tab === 'posts' ? (
          <>
            {userPosts.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  border: '1px solid #ddd',
                  borderRadius: 12,
                  background: '#fafafa',
                }}
              >
                <strong>No posts yet.</strong>
                <div style={{ marginTop: 6, color: '#666' }}>
                  {isOwnProfile
                    ? 'Your posts will show up here.'
                    : `${profileAuthor} has not posted yet.`}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {userPosts.map((post) => (
                  <article
                    key={post.id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 14,
                      padding: 16,
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontSize: 13, color: '#666' }}>
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
                      via {STATION_NAMES[post.stationId] || post.stationId} •{' '}
                      {formatTimeAgo(post.createdAt)}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.45,
                      }}
                    >
                      {post.text}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        marginTop: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Link href={`/post/${post.id}`}>Open thread</Link>
                      <span style={{ color: '#666' }}>
                        ❤️ {post.likes || 0}
                      </span>
                      <span style={{ color: '#666' }}>
                        💬 {post.comments.length}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {userReplies.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  border: '1px solid #ddd',
                  borderRadius: 12,
                  background: '#fafafa',
                }}
              >
                <strong>No replies yet.</strong>
                <div style={{ marginTop: 6, color: '#666' }}>
                  {isOwnProfile
                    ? 'Your replies will show up here.'
                    : `${profileAuthor} has not replied yet.`}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {userReplies.map((reply) => (
                  <article
                    key={reply.id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 14,
                      padding: 16,
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontSize: 13, color: '#666' }}>
                      Replied on{' '}
                      {reply.postTopic ? (
                        <>
                          <Link
                            href={`/topic/${encodeURIComponent(
                              reply.postTopic
                            )}`}
                            style={{ color: 'inherit' }}
                          >
                            {reply.postTopic}
                          </Link>
                          {' • '}
                        </>
                      ) : null}
                      via{' '}
                      {STATION_NAMES[reply.postStationId] ||
                        reply.postStationId}{' '}
                      • {formatTimeAgo(reply.createdAt)}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.45,
                      }}
                    >
                      {reply.text}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color: '#666',
                      }}
                    >
                      On a post by <strong>{reply.postAuthor}</strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        marginTop: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Link href={`/post/${reply.postId}`}>Open thread</Link>
                      <span style={{ color: '#666' }}>
                        ❤️ {reply.likes || 0}
                      </span>
                      <span style={{ color: '#666' }}>
                        {reply.parentId ? 'Nested reply' : 'Direct reply'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
