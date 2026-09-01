import type { loadMatter } from './matters';
import type { Template } from './types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function presetValues(
  matter: Awaited<ReturnType<typeof loadMatter>>,
  user: { full_name: string },
  placeholders: Template['placeholders'],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of placeholders) {
    switch (p.token) {
      case 'client_name':
        map[p.token] = matter.clients?.full_name ?? '';
        break;
      case 'matter_title':
        map[p.token] = matter.title;
        break;
      case 'file_reference':
        map[p.token] = matter.file_reference;
        break;
      case 'today_date':
      case 'date':
        map[p.token] = today();
        break;
      case 'advocate_name':
        map[p.token] = user.full_name;
        break;
      case 'kes_amount':
        map[p.token] = '';
        break;
      default:
        map[p.token] = '';
    }
  }
  return map;
}
