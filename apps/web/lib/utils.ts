import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind 클래스 병합 helper (shadcn/ui 표준).
 * clsx → tailwind-merge 순서로 처리하여 중복 클래스 자동 정리.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
