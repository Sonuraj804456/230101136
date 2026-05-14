# Stage 1

## REST API endpoints

### GET /notifications
- Purpose: Fetch user notifications with filtering, paging, and read-state support.
- Query parameters:
  - `studentId` (required)
  - `status` (`all` | `unread`)
  - `type` (`Event` | `Result` | `Placement`)
  - `limit` (number, default `50`)
- Headers:
  - `Authorization: Bearer <token>`
  - `Accept: application/json`

#### Example response
```json
{
  "notifications": [
    {
      "id": "...",
      "studentId": "1042",
      "type": "Placement",
      "message": "New placement update available",
      "timestamp": "2026-05-14T10:00:00Z",
      "isRead": false
    }
  ]
}
```

### POST /notifications
- Purpose: Create a new notification for a student.
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body:
```json
{
  "studentId": "1042",
  "type": "Result",
  "message": "Your exam result is published"
}
```

#### Example response
```json
{
  "notification": {
    "id": "...",
    "studentId": "1042",
    "type": "Result",
    "message": "Your exam result is published",
    "timestamp": "2026-05-14T10:00:00Z",
    "isRead": false
  }
}
```

### PUT /notifications/:id/read
- Purpose: Mark a single notification as read.
- Headers:
  - `Authorization: Bearer <token>`

#### Example response
```json
{
  "notification": {
    "id": "...",
    "isRead": true
  }
}
```

### GET /notifications/priority
- Purpose: Return the top `n` unread notifications ordered by priority and recency.
- Query parameters:
  - `studentId` (required)
  - `limit` (default `10`)

### GET /notifications/stream
- Purpose: Real-time notification delivery using Server-Sent Events (SSE).
- Query parameters:
  - `studentId` (required)
- Headers:
  - `Authorization: Bearer <token>`

## Real-time notification mechanism
- Use SSE to keep a lightweight open connection from browser to backend.
- Stream new notifications immediately when generated.
- Keep notifications in system state and push only changes.
- Alternative: WebSockets if bidirectional interaction is needed, but SSE is sufficient for server-driven updates.

# Stage 2

## Recommended storage
- Use PostgreSQL as the primary datastore.
- Reason: notification records are structured, need strong consistency for read state and type classification, and relational joins are helpful for students and notification metadata.
- If the volume grows beyond tens of millions, an event stream or specialized time-series store is still possible, but PostgreSQL handles 5M rows with the right indexes.

## Schema

```sql
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(256),
  email VARCHAR(320),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE notification_type AS ENUM ('Event', 'Result', 'Placement');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER REFERENCES students(id),
  notification_type notification_type NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_student_read_created ON notifications(student_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_type_created ON notifications(notification_type, created_at DESC);
```

## Data growth challenges
- High volume of writes during bulk operations.
- Large read scans for unread notifications.
- Potential table bloat from frequent update of `is_read`.

## Mitigations
- Add composite indexes matching the query patterns.
- Use pagination and limit scans.
- Archive older notifications into a cold storage table if retention is longer than required.
- Consider a read replica for UI-heavy fetch operations.

## Query examples

- Get unread notifications for a student:
```sql
SELECT id, notification_type, message, created_at
FROM notifications
WHERE student_id = 1042
  AND is_read = FALSE
ORDER BY created_at DESC
LIMIT 50;
```

- Insert a notification:
```sql
INSERT INTO notifications(student_id, notification_type, message)
VALUES (1042, 'Placement', 'A new placement has been posted');
```

# Stage 3

## Query accuracy and performance
The query:
```sql
SELECT *
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt DESC;
```
- It is functionally correct for unread notifications, but it can be slow because:
  - It scans all notifications for the student before sorting.
  - Without a composite index, the database may perform a full table scan or a large index scan.
- The computation cost is proportional to the number of rows for that student and the cost of sorting.

## Recommended optimization
- Add an index on `(studentID, isRead, createdAt DESC)`.
- Limit returned rows when the UI only needs a page of results.

## Index advice
- Adding indexes on every column is not effective.
- Each index incurs write overhead and storage cost.
- Only add indexes for actual query patterns, such as student filtering plus unread state and ordering.

## Placement notification query
```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```

# Stage 4

## Performance improvements
1. Cache the student notification list in a fast store such as Redis.
   - Pros: much faster page load.
   - Cons: cache invalidation complexity when notifications are created or read.

2. Use pagination and infinite scroll.
   - Pros: smaller result sets per request.
   - Cons: additional client-side state.

3. Precompute unread counts and top-priority notification pointers.
   - Pros: avoids scanning full row sets on every page load.
   - Cons: some write-time overhead to maintain counters.

4. Use a read replica or a materialized view for heavy read workloads.
   - Pros: offloads traffic from the primary database.
   - Cons: eventual consistency and replication lag.

5. Introduce event-driven delivery.
   - Pros: push changes only when needed, rather than fetching on every page load.
   - Cons: more complex architecture.

## Best solution
- Combine server-side pagination, caching, and a dedicated unread-count store.
- Use SSE or web sockets for real-time updates so the UI does not re-fetch the full list on every navigation.

# Stage 5

## Shortcomings of the original implementation
- Synchronous loop causes high latency for 50,000 students.
- If `send_email` fails mid-run, partial success leaves inconsistent state.
- The code is not idempotent, so retries may create duplicates.
- Email send and DB insert are tightly coupled, causing cascading failures.

## Reliable redesign
- Use asynchronous batching with a queue.
- Persist notification records first, then push events to delivery systems.
- Keep email sending and in-app notification steps separate but coordinated.
- Add retries and dead-letter handling for failed emails.
- Use idempotency keys to avoid duplicate notifications.

## Revised pseudocode
```python
function notify_all(student_ids, message):
  notification_batch = []
  for student_id in student_ids:
    notification_id = create_notification_record(student_id, message)
    notification_batch.append({
      "studentId": student_id,
      "notificationId": notification_id,
      "message": message,
      "type": "Placement"
    })

  enqueue_notifications(notification_batch)

function worker_process_notification_batch(batch):
  for item in batch:
    try:
      publish_realtime_event(item.studentId, item.notificationId, item.message)
    except TransientError:
      retry_later(item)

    try:
      send_email(item.studentId, item.message)
      mark_notification_sent(item.notificationId)
    except EmailError as err:
      mark_notification_failed(item.notificationId, err)
      enqueue_retry(item)
```

## Should DB save and email sending happen together?
- No, they should not be in the same blocking operation.
- Save the notification first so the record exists even if delivery fails.
- Then execute delivery asynchronously.
- This separation improves reliability and makes failure recovery more predictable.

# Stage 6

## Implementation notes
- The top priority inbox is based on a score that combines:
  - type weight: `Placement > Result > Event`
  - recency: newer notifications are ranked higher within the same type.
- The actual code is provided in `notification_app_be/fetch_priority_notifications.js`.
- The script fetches notifications from the evaluation API using `Authorization` header and prints the top 10.

## Example usage
```bash
NOTIFICATION_API_TOKEN='Bearer <token>' npm run priority
```

## Priority formula
- `Placement` receives the highest base weight.
- `Result` receives a moderate weight.
- `Event` receives the lowest weight.
- Recent timestamps increase rank among notifications with the same type.

## Notes on new notifications
- The implementation is stateless and recomputes the top list on each fetch.
- It will keep working as new notifications arrive from the external API.
