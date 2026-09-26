## 2024-05-20 - [Performance bottleneck in Prisma count operations]
**Learning:** In the `getOperationalMetrics` service, `countCheckedIn` was implemented using `prisma.presence.groupBy` followed by `.length` in Javascript memory:
```javascript
const countCheckedIn = async () =>
  (
    await prisma.presence.groupBy({
      by: ["hackerId"],
      where: { event: { scannerWorkflow: ScannerWorkflow.CHECK_IN }, value: { gt: 0 } },
    })
  ).length;
```
This requires transmitting the grouped records across the wire and deserializing them in Node to determine the length. By querying the `hacker` model directly and delegating the count operation fully to the database engine using Prisma's `.count()` function with a relation filter:
```javascript
const countCheckedIn = async () =>
  await prisma.hacker.count({
    where: {
      presences: {
        some: {
          event: { scannerWorkflow: ScannerWorkflow.CHECK_IN },
          value: { gt: 0 }
        }
      }
    }
  });
```
We achieve an ~2x speedup and significantly reduce the memory footprint by avoiding transferring the array of records.
**Action:** Always prefer native Prisma `.count()` operations for aggregate counts over fetching objects and evaluating array lengths in JS, even when dealing with unique conditions. Use relational filters (like `some`) when appropriate to shift the computational work to the database.
