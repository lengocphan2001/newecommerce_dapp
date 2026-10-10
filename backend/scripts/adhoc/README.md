# Ad-hoc scripts

One-off scripts kept for reference. None of them is wired into `package.json`,
and none is part of the test suite despite some names starting with `test-` —
they are manual inspection and simulation runs, not automated tests.

Run one with:

```bash
cd backend
npx ts-node -r tsconfig-paths/register scripts/adhoc/<file>.ts
```

Read the file before running it. Some of them write to the database.

Scripts that are part of a documented workflow live one directory up and have a
matching `npm run script:*` entry in `backend/package.json`.
