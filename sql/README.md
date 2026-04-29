# SQL Assets

SQL view 정의 파일 — 자세한 명명 규칙·전략은 `.moai/project/structure.md` §4 참조.

- `views/`: 5개 렌즈 + concern_score + ranking view 정의 (Phase 2에서 채움)
- `migrations/`: 자체 테이블이 필요할 경우만 (현재 read-only replica이므로 비어있음)

각 SQL 파일은 `apps/web/lib/lenses/*.ts`에서 raw text loader로 import 후 파라미터 바인딩 실행한다.
