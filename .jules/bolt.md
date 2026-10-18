## 2024-05-18 - Distinct Counting with Prisma in Node
**Learning:** Found O(N) operation measuring distinct array elements retrieved from DB (`new Set(rows.map(row => row.projectId)).size`) after a `findMany` query. This consumes extra JS memory and compute time as array sizes grow.
**Action:** Replace `findMany` followed by JS `Set` operations with Prisma `findMany({ distinct: ["projectId"], select: { projectId: true } }).length` for better performance at the DB layer, as Prisma `count` doesn`t support distinct in this project version.
