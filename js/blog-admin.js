// ─── BLOG ADMIN: 記事 CRUD ─────────────────────────────────────────────────────

const postModal = document.getElementById('post-modal');

async function loadPosts() {
  const tbody = document.getElementById('posts-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="empty-state">読み込み中...</td></tr>';

  try {
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, tags, emoji, published, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    document.getElementById('posts-count').textContent = `${data.length} 件`;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">まだ記事がありません</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(post => {
      const tags = (post.tags || []).map(t => `<span class="badge badge-draft">${escHtml(t)}</span>`).join(' ');
      const date = new Date(post.created_at).toLocaleDateString('ja-JP');
      const badge = post.published
        ? '<span class="badge badge-published">公開</span>'
        : '<span class="badge badge-draft">下書き</span>';
      return `
        <tr>
          <td>${escHtml(post.emoji || '📝')} <strong>${escHtml(post.title)}</strong></td>
          <td>${tags}</td>
          <td>${badge}</td>
          <td style="color:#556">${date}</td>
          <td>
            <div class="td-actions">
              <button class="btn-sm btn-edit" onclick="openEditModal(${post.id})">編集</button>
              <button class="btn-sm btn-toggle" onclick="togglePublish(${post.id}, ${post.published})">${post.published ? '非公開' : '公開'}</button>
              <button class="btn-sm btn-delete" onclick="deletePost(${post.id})">削除</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">読み込みに失敗しました: ${e.message}</td></tr>`;
  }
}

function openNewModal() {
  document.getElementById('modal-title').textContent = '記事を作成';
  document.getElementById('edit-post-id').value = '';
  document.getElementById('edit-title').value = '';
  document.getElementById('edit-emoji').value = '📝';
  document.getElementById('edit-tags').value = '';
  document.getElementById('edit-excerpt').value = '';
  document.getElementById('edit-content').value = '';
  document.getElementById('edit-published').checked = false;
  postModal.classList.add('open');
}

async function openEditModal(id) {
  const { data: post, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error || !post) { alert('記事の読み込みに失敗しました'); return; }

  document.getElementById('modal-title').textContent = '記事を編集';
  document.getElementById('edit-post-id').value = post.id;
  document.getElementById('edit-title').value = post.title || '';
  document.getElementById('edit-emoji').value = post.emoji || '📝';
  document.getElementById('edit-tags').value = (post.tags || []).join(', ');
  document.getElementById('edit-excerpt').value = post.excerpt || '';
  document.getElementById('edit-content').value = post.content || '';
  document.getElementById('edit-published').checked = !!post.published;
  postModal.classList.add('open');
}

function closeModal() {
  postModal.classList.remove('open');
}

async function savePost() {
  const id = document.getElementById('edit-post-id').value;
  const title = document.getElementById('edit-title').value.trim();
  if (!title) { alert('タイトルを入力してください'); return; }

  const payload = {
    title,
    emoji: document.getElementById('edit-emoji').value.trim() || '📝',
    tags: document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    excerpt: document.getElementById('edit-excerpt').value.trim(),
    content: document.getElementById('edit-content').value.trim(),
    published: document.getElementById('edit-published').checked,
  };

  const btn = document.getElementById('modal-save');
  btn.disabled = true;
  btn.textContent = '保存中...';

  try {
    let error;
    if (id) {
      ({ error } = await supabase.from('posts').update({...payload, updated_at: new Date().toISOString()}).eq('id', id));
    } else {
      ({ error } = await supabase.from('posts').insert(payload));
    }
    if (error) throw error;
    closeModal();
    loadPosts();
  } catch (e) {
    alert('保存に失敗しました: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '保存する';
  }
}

async function togglePublish(id, currentPublished) {
  const { error } = await supabase.from('posts').update({ published: !currentPublished, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { alert('更新に失敗しました'); return; }
  loadPosts();
}

async function deletePost(id) {
  if (!confirm('この記事を削除しますか？\nこの操作は取り消せません。')) return;
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) { alert('削除に失敗しました: ' + error.message); return; }
  loadPosts();
}

// ─── MODAL イベント ────────────────────────────────────────────────────────────
document.getElementById('btn-new-post')?.addEventListener('click', openNewModal);
document.getElementById('modal-save')?.addEventListener('click', savePost);
document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
document.getElementById('post-modal')?.addEventListener('click', e => {
  if (e.target === postModal) closeModal();
});

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
