## 2024-06-25 - Parallelize Database Queries
**Learning:** Multiple independent database queries within a tRPC router can be parallelized using `Promise.all` to significantly improve API response time.
**Action:** When a router is fetching different resources that do not depend on each other, always execute them concurrently with `Promise.all` instead of sequentially awaiting them. Also ensure to eliminate redundant database calls if the same value can be reused within the endpoint.
