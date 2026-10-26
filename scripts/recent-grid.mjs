// 최근 몇 주의 기여 그래프만 크게 그린 SVG를 만든다(다크·라이트 두 장).
// GitHub GraphQL의 contributionCalendar를 읽으므로 프로필 잔디와 같은 숫자다(공개 설정된 비공개 기여 포함).
// 사용: GITHUB_TOKEN=… node scripts/recent-grid.mjs <user> <outDir> [weeks]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [user = 'znan2', outDir = 'dist', weeksArg = '12'] = process.argv.slice(2);
const WEEKS = Math.max(4, Math.min(26, Number(weeksArg) || 12));
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN이 필요합니다');

const to = new Date();
const from = new Date(to.getTime() - (WEEKS * 7 + 7) * 86400e3);
const query = `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){
  contributionCalendar{weeks{contributionDays{date weekday contributionCount contributionLevel}}}}}}`;
const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'recent-grid' },
  body: JSON.stringify({ query, variables: { login: user, from: from.toISOString(), to: to.toISOString() } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(`GraphQL 실패: HTTP ${res.status} ${JSON.stringify(json.errors ?? '')}`);
const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks.slice(-WEEKS);

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
const THEMES = {
  dark: { text: '#e6edf3', muted: '#9198a1', cells: ['#151b23', '#033a16', '#196c2e', '#2ea043', '#56d364'] },
  light: { text: '#1f2328', muted: '#59636e', cells: ['#eff2f5', '#aceebb', '#4ac26b', '#2da44e', '#116329'] },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CELL = 22, GAP = 5, LEFT = 40, TOP = 76;
const width = LEFT + weeks.length * (CELL + GAP) + 8;
const height = TOP + 7 * (CELL + GAP) + 34;
const days = weeks.flatMap((w) => w.contributionDays);
const total = days.reduce((n, d) => n + d.contributionCount, 0);
const fmt = (s) => { const d = new Date(s + 'T00:00:00Z'); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };

function svg(theme) {
  const t = THEMES[theme];
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif">`);
  out.push(`<text x="${LEFT}" y="22" font-size="15" font-weight="600" fill="${t.text}">${total.toLocaleString('en-US')} contributions in the last ${weeks.length} weeks</text>`);
  // 기간은 제목 아래 줄에 둔다(폭이 좁을 때 제목과 겹치지 않게)
  out.push(`<text x="${LEFT}" y="42" font-size="12" fill="${t.muted}">${fmt(days[0].date)} – ${fmt(days.at(-1).date)}</text>`);
  // 월 라벨: 그 달이 처음 나오는 주 위에
  let lastMonth = -1;
  weeks.forEach((w, i) => {
    const m = new Date(w.contributionDays[0].date + 'T00:00:00Z').getUTCMonth();
    if (m !== lastMonth) {
      out.push(`<text x="${LEFT + i * (CELL + GAP)}" y="${TOP - 10}" font-size="12" fill="${t.muted}">${MONTHS[m]}</text>`);
      lastMonth = m;
    }
  });
  [['Mon', 1], ['Wed', 3], ['Fri', 5]].forEach(([label, wd]) => {
    out.push(`<text x="0" y="${TOP + wd * (CELL + GAP) + CELL * 0.7}" font-size="12" fill="${t.muted}">${label}</text>`);
  });
  weeks.forEach((w, i) => {
    for (const d of w.contributionDays) {
      const x = LEFT + i * (CELL + GAP), y = TOP + d.weekday * (CELL + GAP);
      out.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="4" fill="${t.cells[LEVEL[d.contributionLevel] ?? 0]}"><title>${d.date}: ${d.contributionCount}</title></rect>`);
    }
  });
  // 범례
  const ly = TOP + 7 * (CELL + GAP) + 14;
  let lx = width - 8 - 5 * 16 - 34;
  out.push(`<text x="${lx - 8}" y="${ly + 10}" font-size="12" text-anchor="end" fill="${t.muted}">Less</text>`);
  t.cells.forEach((c) => { out.push(`<rect x="${lx}" y="${ly}" width="12" height="12" rx="2" fill="${c}"/>`); lx += 16; });
  out.push(`<text x="${lx + 4}" y="${ly + 10}" font-size="12" fill="${t.muted}">More</text>`);
  out.push('</svg>');
  return out.join('\n');
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'recent.svg'), svg('light'));
writeFileSync(join(outDir, 'recent-dark.svg'), svg('dark'));
console.log(`recent grid: ${weeks.length} weeks, ${total} contributions`);
