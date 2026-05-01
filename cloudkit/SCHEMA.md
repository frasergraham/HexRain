# CloudKit Schema Diagram

The container `iCloud.com.hexrain.app` splits across two databases:

- **Private DB** — per-user, free quota, invisible to other users.
  Holds backup of progress + custom challenges so a wipe / new device
  restores them.
- **Public DB** — shared corpus, queryable by everyone. Hosts the
  community-published challenges plus their leaderboards, likes, and
  reports.

## Relationships

```mermaid
erDiagram
    Progress {
      string recordName "always 'progress'"
      string payload "JSON ChallengeProgress"
      double modifiedAt
    }
    CustomChallenge {
      string recordName "custom:UUID"
      string name
      int difficulty
      string effects "JSON"
      list waves
      string publishedRecordName "set when author published"
      int publishedVersion
      string installedFrom "set when installed from community"
      int installedVersion
      string installedAuthorName
    }
    PublishedChallenge {
      string recordName "pub-{AUTHOR}-{CUSTOM}"
      string name
      string authorId "CK user record name"
      string authorName "Game Center display name"
      int difficulty
      list waves
      string status "approved | pending | hidden"
      int version
      double publishedAt
      double updatedAt
      int installCount
      int playCount
      int upvoteCount
      int reportCount
    }
    Score {
      string recordName "score-{PLAYER}-{CHALLENGE}"
      reference challengeRef
      string playerId
      string playerName
      double score "best per player"
      int attempts "all-time runs"
      int pct "best %"
    }
    Upvote {
      string recordName "upvote-{PLAYER}-{CHALLENGE}"
      reference challengeRef
      string playerId
    }
    Report {
      string recordName "report-{REPORTER}-{CHALLENGE}"
      reference challengeRef
      string reporterId
      string reason "enum"
      string note "optional"
      double reportedAt
    }

    CustomChallenge }o..o| PublishedChallenge : "publishedRecordName / installedFrom"
    PublishedChallenge ||--o{ Score : challengeRef
    PublishedChallenge ||--o{ Upvote : challengeRef
    PublishedChallenge ||--o{ Report : challengeRef
```

## Database split (ASCII summary)

```
┌──────── PRIVATE DB (per-user) ────────┐   ┌──────── PUBLIC DB (shared) ────────┐
│                                       │   │                                    │
│  Progress              (1 record)     │   │  PublishedChallenge                │
│    payload: ChallengeProgress JSON    │   │    name, author, difficulty, waves │
│                                       │   │    status, version                 │
│  CustomChallenge       (N records)    │   │    installCount, playCount,        │
│    waves, effects, stars              │   │    upvoteCount, reportCount        │
│    publishedRecordName ───────────────┼──▶│    ▲    ▲    ▲                     │
│    installedFrom      ◀───────────────┼───┤    │    │    │                     │
│                                       │   │    │    │    │                     │
└───────────────────────────────────────┘   │  Score│    │  Report               │
                                            │   per-(player, challenge)          │
                                            │   best score + attempts            │
                                            │                                    │
                                            │      Upvote                        │
                                            │   per-(player, challenge)          │
                                            │   existence = liked                │
                                            └────────────────────────────────────┘
```

## Write paths

| Action                      | Touches                                          |
| ---                         | ---                                              |
| Save progress / custom edit | `Progress.upsert`, `CustomChallenge.upsert`      |
| Publish                     | `PublishedChallenge.upsert` (version++)          |
| Re-publish (silent update)  | Same record, version++; subscribers patched in place |
| Install                     | Local `CustomChallenge` (new record with `installedFrom`); `PublishedChallenge.installCount++` |
| Run end (community)         | `Score.upsert` (best score, attempts++); `PublishedChallenge.playCount++` |
| Like                        | `Upvote.upsert`; `PublishedChallenge.upvoteCount++` |
| Unlike                      | `Upvote.delete`; `PublishedChallenge.upvoteCount--` |
| Report                      | `Report.upsert`; `PublishedChallenge.reportCount++` |
| Moderator hide              | `PublishedChallenge.status = "hidden"`           |

## Read paths

| Surface                 | Query                                                                  |
| ---                     | ---                                                                    |
| Cold-launch progress pull | `Progress.fetch("progress")` + `CustomChallenge.query(TRUEPREDICATE)` |
| Community list (NEW)    | `PublishedChallenge` where `status == "approved"` sort `publishedAt`   |
| Community list (TOP)    | sort `upvoteCount`                                                     |
| Community list (ACTIVE) | sort `installCount`                                                    |
| Community list (INSTALLED) | client-side iterate local installs, fetch each `PublishedChallenge` |
| Leaderboard             | `Score` where `challengeRef == X` sort `score` desc, limit 20          |
| Has-upvoted check       | `Upvote.fetch("upvote-{PLAYER}-{CHALLENGE}")`                          |
| Live updates            | CKQuerySubscription on `recordID == X` for each installed name         |
