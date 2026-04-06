'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  addNotification,
  getUnreadNotificationCount,
  getUserStats,
  initialiseBackendIdentity,
  isFollowing,
  loadFollows,
  loadPosts,
  PostItem,
  saveFollows,
  toggleFollow,
} from '../lib/banta';

type PersonRow = {
  name: string;
  posts: number;
  replies: number;
  followers: number;
  following: number;
  likesReceived: number;
  lastActiveAt: number | null;
};

function getCredibilityLabel(person: PersonRow) {
  const totalContributions = person.posts + person.replies;

  if (totalContributions >= 10 || person.followers >= 3) {
    return 'Regular voice';
  }

  if (totalContributions >= 4) {
    return 'Getting active';
  }

  return 'Early contributor';
}

export default function PeoplePage() {
  const [mounted, setMounted] = useState(false);
  const [viewer, setViewer] = useState('Peter T');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const identity = await initialiseBackendIdentity();
      if (cancelled) return;

      const current = identity.author;
      setViewer(current);
      setPosts(loadPosts());
      setUnreadCount(getUnreadNotificationCount(current));
    };

    refresh().then(() => {
      if (!cancelled) setMounted(true);
    });

    const onFocus = () => refresh();
    const onStorage = () => refresh();

    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshKey]);

  const people = useMemo<PersonRow[]>(() => {
    const map = new Map<string, { lastActiveAt: number | null }>();

    for (const post of posts) {
      const existing = map.get(post.author);
      map.set(post.author, {
        lastActiveAt: existing?.lastActiveAt
          ? Math.max(existing.lastActiveAt, post.createdAt)
          : post.createdAt,
      });

      for (const comment of post.comments) {
        const existingCommentAuthor = map.get(comment.author);
        map.set(comment.author, {
          lastActiveAt: existingCommentAuthor?.lastActiveAt
            ? Math.max(existingCommentAuthor.lastActiveAt, comment.createdAt)
            : comment.createdAt,
        });
      }
    }

    const rows: PersonRow[] = Array.from(map.keys()).map((name) => {
      const stats = getUserStats(name);

      return {
        name,
        posts: stats.posts,
        replies: stats.replies,
        followers: stats.followers,
        following: stats.following,
        likesReceived: stats.likesReceived,
        lastActiveAt: map.get(name)?.lastActiveAt ?? null,
      };
    });

    return rows.sort((a, b) => {
      const aScore = a.posts + a.replies + a.followers;
      const bScore = b.posts + b.replies + b.followers;

      if (bScore !== aScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    });
  }, [posts, refreshKey]);

  function handleToggleFollow(targetUser: string) {
    if (targetUser === viewer) return;

    const wasFollowing = isFollowing(viewer, targetUser);
    toggleFollow(viewer, targetUser);

    const refreshed = loadFollows();
    saveFollows(refreshed);

    if (!wasFollowing) {
      addNotification({
        type: 'follow',
        toUser: targetUser,
        fromUser: viewer,
        text: `${viewer} followed you`,
      });
    }

    setRefreshKey((v) => v + 1);
  }

  if (!mounted) {
    return (
      <main
        style={{
          padding: 24,
          maxWidth: 920,
          margin: '0 auto',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p>Loading people…</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 920,
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
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>People</h1>
        <p style={{ marginTop: 0, color: '#666', lineHeight: 1.45 }}>
          Discover the voices already showing up in Banta. Follow people to make
          your feed feel more personal.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 12,
          }}
        >
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 999,
              padding: '8px 12px',
            }}
          >
            People: <strong>{people.length}</strong>
          </div>

          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: 999,
              padding: '8px 12px',
            }}
          >
            Viewing as <strong>{viewer}</strong>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        {people.length === 0 ? (
          <div
            style={{
              padding: 16,
              border: '1px solid #ddd',
              borderRadius: 12,
              background: '#fafafa',
            }}
          >
            <strong>No people yet.</strong>
            <div style={{ marginTop: 6, color: '#666' }}>
              Create a few posts under different names and they will appear
              here.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {people.map((person) => {
              const following = isFollowing(viewer, person.name);
              const isOwnProfile = person.name === viewer;

              return (
                <article
                  key={person.name}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 14,
                    padding: 16,
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
                      <div style={{ fontSize: 20, fontWeight: 700 }}>
                        <Link
                          href={`/u/${encodeURIComponent(person.name)}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          {person.name}
                        </Link>
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          gap: 10,
                          flexWrap: 'wrap',
                          color: '#666',
                          fontSize: 14,
                        }}
                      >
                        <span>{getCredibilityLabel(person)}</span>
                        <span>•</span>
                        <span>
                          {person.lastActiveAt
                            ? `Active ${new Date(
                                person.lastActiveAt
                              ).toLocaleDateString()}`
                            : 'New around here'}
                        </span>
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
                        onClick={() => handleToggleFollow(person.name)}
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
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                      marginTop: 14,
                    }}
                  >
                    <div
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 999,
                        padding: '8px 12px',
                      }}
                    >
                      Posts: <strong>{person.posts}</strong>
                    </div>

                    <div
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 999,
                        padding: '8px 12px',
                      }}
                    >
                      Replies: <strong>{person.replies}</strong>
                    </div>

                    <div
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 999,
                        padding: '8px 12px',
                      }}
                    >
                      Likes: <strong>{person.likesReceived}</strong>
                    </div>

                    <div
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 999,
                        padding: '8px 12px',
                      }}
                    >
                      Followers: <strong>{person.followers}</strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Link href={`/u/${encodeURIComponent(person.name)}`}>
                      Open profile
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
