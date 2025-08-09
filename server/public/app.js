(function() {
  const form = document.getElementById('convert-form');
  const statusEl = document.getElementById('status');
  const fileInput = document.getElementById('file');
  const textInput = document.getElementById('text');
  const filenameInput = document.getElementById('filename');
  const titleInput = document.getElementById('title');
  const formatInput = document.getElementById('format');
  const fileNameEl = document.getElementById('file-name');
  const dropzone = document.getElementById('dropzone');

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear().toString();

  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const panel = document.getElementById(tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  function updateFileLabel() {
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      fileNameEl.textContent = `${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
      if (!filenameInput.value) {
        const base = file.name.replace(/\.[^/.]+$/, '');
        filenameInput.value = base;
      }
    } else {
      fileNameEl.textContent = 'No file selected';
    }
  }

  if (fileInput) {
    fileInput.addEventListener('change', updateFileLabel);
  }

  if (dropzone) {
    const setDrag = (on) => dropzone.classList.toggle('dragover', on);
    ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); setDrag(true); }));
    ['dragleave', 'dragend', 'drop'].forEach(evt => dropzone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); if (evt !== 'drop') setDrag(false); }));
    dropzone.addEventListener('drop', (e) => {
      setDrag(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        fileInput.files = files;
        updateFileLabel();
      }
    });
    dropzone.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

  async function convertToPdf(e) {
    e.preventDefault();
    statusEl.textContent = '';

    const activeTab = document.querySelector('.tab.active').dataset.tab;
    const formData = new FormData();

    const filename = filenameInput.value.trim();
    const title = (titleInput && titleInput.value.trim()) || '';
    const format = formatInput.value;
    if (filename) formData.append('filename', filename);
    if (title) formData.append('title', title);
    if (format) formData.append('format', format);

    if (activeTab === 'file-tab') {
      if (!fileInput.files || !fileInput.files[0]) {
        statusEl.textContent = 'Please choose a Markdown file or switch to Paste text.';
        return;
      }
      formData.append('file', fileInput.files[0]);
    } else {
      const text = textInput.value.trim();
      if (!text) {
        statusEl.textContent = 'Please paste some Markdown text or upload a file.';
        return;
      }
      formData.append('text', text);
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Converting…';

    try {
      const res = await fetch('/convert', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        let msg = `Server error (${res.status})`;
        try {
          const data = await res.json();
          if (data && data.error) msg = `${msg}: ${data.error}`;
        } catch (_) {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const downloadName = (filename || 'document') + '.pdf';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      statusEl.textContent = 'Done. Your download should start automatically.';
    } catch (err) {
      statusEl.textContent = err.message || String(err);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  form.addEventListener('submit', convertToPdf);
})(); 