// ─── VISITOR STATS + CHART ────────────────────────────────────────────────────

(async function() {
  // ─ 統計数値を表示
  async function loadNumbers() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      const [totalRes, todayRes, weekRes, postsRes] = await Promise.all([
        supabase.from('visits').select('id', { count: 'exact', head: true }),
        supabase.from('visits').select('id', { count: 'exact', head: true }).gte('visited_at', today),
        supabase.from('visits').select('id', { count: 'exact', head: true }).gte('visited_at', weekAgo),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('published', true),
      ]);

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = (val ?? 0).toLocaleString(); };
      set('d-total', totalRes.count);
      set('d-today', todayRes.count);
      set('d-week', weekRes.count);
      set('d-posts', postsRes.count);
    } catch (e) {
      console.warn('visitor stats error:', e);
    }
  }

  // ─ 過去14日間の日別グラフ
  async function loadChart() {
    const canvas = document.getElementById('visitor-chart');
    if (!canvas) return;

    try {
      const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('public_visit_stats')
        .select('visit_date, total_visits')
        .gte('visit_date', since)
        .order('visit_date', { ascending: true });

      if (error) throw error;

      // 過去14日の日付ラベルを生成（データがない日は0補完）
      const labels = [];
      const counts = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        labels.push(d.slice(5));  // MM-DD 形式
        const found = (data || []).find(r => r.visit_date === d);
        counts.push(found ? found.total_visits : 0);
      }

      new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'アクセス数',
            data: counts,
            borderColor: '#00f0ff',
            backgroundColor: 'rgba(0,240,255,0.06)',
            borderWidth: 2,
            pointBackgroundColor: '#00f0ff',
            pointRadius: 4,
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(5,5,16,0.9)',
              borderColor: 'rgba(0,240,255,0.3)',
              borderWidth: 1,
              titleColor: '#00f0ff',
              bodyColor: '#e0e0ff',
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.03)' },
              ticks: { color: '#445', font: { size: 11 } }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.03)' },
              ticks: { color: '#445', font: { size: 11 }, precision: 0 },
              beginAtZero: true,
            }
          }
        }
      });
    } catch (e) {
      const wrap = canvas.parentElement;
      if (wrap) wrap.innerHTML = '<div style="color:#334;text-align:center;padding:60px;">Supabase接続後にグラフが表示されます</div>';
    }
  }

  await Promise.all([loadNumbers(), loadChart()]);
})();
