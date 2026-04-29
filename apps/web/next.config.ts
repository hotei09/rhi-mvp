import type { NextConfig } from 'next';

// Next.js 16 minimal config — Phase 0 scaffolding
// 추가 설정은 후속 Phase에서 필요 시 부착 (이미지 도메인, 보안 헤더 등).
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
