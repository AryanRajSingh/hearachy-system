/* ==========================================
   script.js — Company Hierarchy Management
   Role-Based Access Control Updated
   ========================================== */
(() => {
  const storageKey = 'orgflow_v1';
  let state = { roles: [{ id: 'r1', name: 'CEO' }], nodes: [] };

  // ---------- Helpers ----------
  const $ = id => document.getElementById(id);
  const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
  const load = () => {
    const raw = localStorage.getItem(storageKey);
    if (raw) state = JSON.parse(raw);
  };
  const uid = (p = 'n') => p + '_' + Math.random().toString(36).slice(2, 9);

  // ---------- Role-based Access ----------
  const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
  if (!loggedInUser) {
    window.location.href = 'auth.html';
  }
  const isAdmin = loggedInUser.role === 'admin';

  // ---------- Roles ----------
  function renderRoles() {
    const ul = $('roles-list');
    ul.innerHTML = '';
    const sel = $('person-role');
    sel.innerHTML = '';

    state.roles.forEach(r => {
      const li = document.createElement('li');
      li.textContent = r.name;

      if (isAdmin) {
        const del = document.createElement('button');
        del.textContent = '✕';
        del.title = 'Delete role';
        del.addEventListener('click', e => {
          e.stopPropagation();
          if (confirm('Delete this role and clear it from people?')) {
            removeRole(r.id);
          }
        });
        li.appendChild(del);
      }

      ul.appendChild(li);

      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
  }

  function removeRole(roleId) {
    state.roles = state.roles.filter(r => r.id !== roleId);
    state.nodes.forEach(n => {
      if (n.roleId === roleId) n.roleId = '';
    });
    save();
    render();
  }

  // ---------- Tree Rendering ----------
  function render() {
    renderRoles();
    const tree = $('tree');
    tree.innerHTML = '';

    const roots = state.nodes.filter(n => !n.parentId);
    roots.forEach(r => tree.appendChild(createNodeElement(r)));
  }

  function createNodeElement(node) {
    const wrap = document.createElement('div');

    const card = document.createElement('div');
    card.className = 'node';
    const name = document.createElement('div');
    name.className = 'title';
    name.textContent = node.name || '—';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = getRoleName(node.roleId) || 'Unassigned';

    card.appendChild(name);
    card.appendChild(meta);

    // Node actions (Add/Edit/Delete) only for admin
    if (isAdmin) {
      const actions = document.createElement('div');
      actions.className = 'node-actions';

      const addBtn = document.createElement('button');
      addBtn.textContent = '＋';
      addBtn.title = 'Add Child';
      addBtn.addEventListener('click', e => {
        e.stopPropagation();
        openModal('add', node.id);
      });

      const editBtn = document.createElement('button');
      editBtn.textContent = '✎';
      editBtn.title = 'Edit Person';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        openModal('edit', node.id);
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.title = 'Delete Person';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('Delete this person and all their subordinates?')) {
          deleteNode(node.id);
        }
      });

      actions.append(addBtn, editBtn, delBtn);
      card.appendChild(actions);
    }

    wrap.appendChild(card);

    // Children nodes
    const children = state.nodes.filter(n => n.parentId === node.id);
    if (children.length) {
      const ch = document.createElement('div');
      ch.className = 'node-children';
      children.forEach(c => ch.appendChild(createNodeElement(c)));
      wrap.appendChild(ch);
    }

    return wrap;
  }

  function getRoleName(id) {
    const r = state.roles.find(x => x.id === id);
    return r ? r.name : '';
  }

  // ---------- Node CRUD ----------
  function addNode(parentId, name, roleId) {
    if (!isAdmin) return;
    const n = { id: uid(), name, roleId, parentId };
    state.nodes.push(n);
    save();
    render();
  }

  function updateNode(id, name, roleId) {
    if (!isAdmin) return;
    const n = state.nodes.find(x => x.id === id);
    if (!n) return;
    n.name = name;
    n.roleId = roleId;
    save();
    render();
  }

  function deleteNode(id) {
    if (!isAdmin) return;
    const toDelete = new Set();
    function mark(x) {
      toDelete.add(x);
      state.nodes.filter(n => n.parentId === x).forEach(c => mark(c.id));
    }
    mark(id);
    state.nodes = state.nodes.filter(n => !toDelete.has(n.id));
    save();
    render();
  }

  // ---------- Modal ----------
  let modalMode = null;
  let modalTarget = null;

  function openModal(mode, targetId = null) {
    if (!isAdmin) return;
    modalMode = mode;
    modalTarget = targetId;
    $('modal').classList.remove('hidden');
    $('person-name').focus();

    if (mode === 'add') {
      $('modal-title').textContent = 'Add Person';
      $('person-name').value = '';
      $('person-role').value = state.roles[0]?.id || '';
    } else if (mode === 'edit') {
      $('modal-title').textContent = 'Edit Person';
      const n = state.nodes.find(x => x.id === targetId);
      $('person-name').value = n.name || '';
      $('person-role').value = n.roleId || '';
    }
  }

  function closeModal() {
    $('modal').classList.add('hidden');
    modalMode = null;
    modalTarget = null;
  }

  // ---------- Day/Night Theme ----------
  function setupThemeToggle() {
    const themeBtn = $('theme-toggle');
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
      themeBtn.textContent = document.body.classList.contains('light-mode') ? '☀️' : '🌙';
    });
  }

  // ---------- Event Listeners ----------
  document.addEventListener('DOMContentLoaded', () => {
    load();
    if (!state.nodes.length) addNode(null, 'Alex Sharma', state.roles[0]?.id || '');
    render();
    setupThemeToggle();

    // Add role button only for admin
    if (isAdmin) {
      $('add-role').addEventListener('click', () => {
        const val = $('role-input').value.trim();
        if (!val) return alert('Enter role name');
        state.roles.push({ id: uid('r'), name: val });
        $('role-input').value = '';
        save();
        renderRoles();
      });

      $('add-root').addEventListener('click', () => openModal('add', null));

      $('manage-roles').addEventListener('click', () => {
        const rn = prompt(
          'Enter comma-separated roles (this replaces existing):',
          state.roles.map(r => r.name).join(', ')
        );
        if (rn !== null) {
          state.roles = rn
            .split(',')
            .map(s => ({ id: uid('r'), name: s.trim() }))
            .filter(a => a.name);
          save();
          render();
        }
      });

      $('save-node').addEventListener('click', () => {
        const name = $('person-name').value.trim();
        const roleId = $('person-role').value || '';
        if (!name) return alert('Enter person name');

        if (modalMode === 'add') addNode(modalTarget, name, roleId);
        else if (modalMode === 'edit') updateNode(modalTarget, name, roleId);

        closeModal();
      });

      $('cancel').addEventListener('click', closeModal);

      $('tree').addEventListener('dblclick', e => {
        const el = e.target.closest('.node');
        if (!el) return;
        const name = el.querySelector('.title').textContent;
        const role = el.querySelector('.meta').textContent;
        const node = state.nodes.find(
          n => n.name === name && (getRoleName(n.roleId) || 'Unassigned') === role
        );
        if (node) openModal('edit', node.id);
      });
    }

    // Full tree view
    $('full-tree').addEventListener('click', () => {
      localStorage.setItem('orgflow_v1', JSON.stringify(state));
      window.open('tree.html', '_blank');
    });
  });
})();
