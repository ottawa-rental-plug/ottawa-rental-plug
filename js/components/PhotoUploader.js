class PhotoUploader {
  constructor(containerId, supabaseClient, unitId) {
    this.container = document.getElementById(containerId);
    this.supabase = supabaseClient;
    this.unitId = unitId;
    this.photos = [];
    this.uploadInProgress = false;
    this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    this.ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  }

  async init() {
    this.render();
    this.attachEventListeners();
    await this.loadPhotos();
  }

  render() {
    this.container.innerHTML = `
      <div class="photo-uploader">
        <!-- Upload Area -->
        <div class="upload-section">
          <div class="upload-area" id="uploadArea">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <h3>Upload Property Photos</h3>
            <p>Drag photos here or click to browse</p>
            <input type="file" id="fileInput" multiple accept="image/*" style="display: none;">
          </div>

          <!-- File Input (hidden) -->
          <input type="file" id="fileInputHidden" multiple accept="image/jpeg,image/png,image/webp" style="display: none;">

          <!-- Upload Button -->
          <div class="upload-controls">
            <button id="uploadBtn" class="btn btn-primary" disabled>Upload Photos</button>
            <span id="uploadStatus" class="upload-status"></span>
          </div>

          <!-- Progress Bar -->
          <div id="uploadProgress" class="upload-progress" style="display: none;">
            <div class="progress-bar">
              <div id="progressFill" class="progress-fill"></div>
            </div>
            <span id="progressText" class="progress-text">0%</span>
          </div>
        </div>

        <!-- Photo Gallery -->
        <div class="photo-gallery-section" id="gallerySection" style="display: none;">
          <h3>Property Photos</h3>
          <div id="photoGallery" class="photo-gallery"></div>
        </div>

        <!-- Empty State -->
        <div id="emptyState" class="empty-state" style="display: none;">
          <p>No photos uploaded yet. Upload at least 1 photo to enable syndication.</p>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInputHidden');
    const uploadBtn = document.getElementById('uploadBtn');

    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });

    // File selection
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Upload button
    uploadBtn.addEventListener('click', () => this.uploadFiles());
  }

  handleFiles(fileList) {
    this.photos = Array.from(fileList)
      .filter(f => {
        if (!this.ALLOWED_TYPES.includes(f.type)) {
          alert(`Invalid file type: ${f.name}. Only JPG, PNG, and WebP allowed.`);
          return false;
        }
        if (f.size > this.MAX_FILE_SIZE) {
          alert(`File too large: ${f.name}. Maximum 10MB.`);
          return false;
        }
        return true;
      })
      .map((f, i) => ({
        file: f,
        preview: URL.createObjectURL(f),
        display_order: i,
        is_primary: i === 0
      }));

    this.renderPreview();
    document.getElementById('uploadBtn').disabled = this.photos.length === 0;
    document.getElementById('uploadStatus').textContent = `${this.photos.length} file(s) selected`;
  }

  renderPreview() {
    const preview = document.getElementById('photoGallery') || document.createElement('div');
    preview.id = 'photoGallery';
    preview.className = 'photo-gallery';

    preview.innerHTML = this.photos
      .map((p, i) => `
        <div class="photo-item" draggable="true" data-index="${i}">
          <img src="${p.preview}" alt="Preview ${i + 1}">
          <div class="photo-controls">
            ${p.is_primary ? '<span class="badge badge-primary">Primary</span>' : ''}
            <button class="photo-btn delete-btn" data-action="delete" data-index="${i}" title="Delete">×</button>
          </div>
          ${!p.is_primary ? `<button class="photo-btn primary-btn" data-action="set-primary" data-index="${i}" title="Set as primary">Set Primary</button>` : ''}
        </div>
      `)
      .join('');

    // Make gallery visible
    document.getElementById('gallerySection').style.display = 'block';

    // Attach delete handlers
    preview.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.index);
        this.photos.splice(index, 1);
        this.renderPreview();
        document.getElementById('uploadBtn').disabled = this.photos.length === 0;
      });
    });

    // Attach set-primary handlers
    preview.querySelectorAll('[data-action="set-primary"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.index);
        this.photos.forEach((p, i) => {
          p.is_primary = i === index;
          p.display_order = i === index ? 0 : p.display_order + 1;
        });
        this.renderPreview();
      });
    });

    // Drag and drop reordering
    preview.querySelectorAll('.photo-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target);
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('dragover');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('dragover');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain') || document.querySelector('.photo-item.dragging').dataset.index);
        const toIndex = parseInt(item.dataset.index);

        if (fromIndex !== toIndex) {
          const [movedPhoto] = this.photos.splice(fromIndex, 1);
          this.photos.splice(toIndex, 0, movedPhoto);
          this.photos.forEach((p, i) => p.display_order = i);
          this.renderPreview();
        }

        item.classList.remove('dragover');
      });
    });
  }

  async uploadFiles() {
    if (this.uploadInProgress || this.photos.length === 0) return;
    if (!this.unitId) {
      alert('Unit ID not set');
      return;
    }

    this.uploadInProgress = true;
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('uploadProgress').style.display = 'block';

    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    let completed = 0;
    const total = this.photos.length;

    try {
      for (const photo of this.photos) {
        try {
          // Upload to Supabase Storage
          const fileName = `${Date.now()}_${photo.file.name}`;
          const storagePath = `units/${this.unitId}/${fileName}`;

          console.log(`Uploading: ${storagePath}`);

          const { data: uploadData, error: uploadError } = await this.supabase.storage
            .from('orp-photos')
            .upload(storagePath, photo.file);

          if (uploadError) throw uploadError;

          // Save metadata to photos table
          const { error: dbError } = await this.supabase
            .from('photos')
            .insert([{
              unit_id: this.unitId,
              storage_path: storagePath,
              alt_text: `Photo for unit ${this.unitId}`,
              display_order: photo.display_order,
              is_primary: photo.is_primary
            }]);

          if (dbError) throw dbError;

          completed++;
          const percent = Math.round((completed / total) * 100);
          progressFill.style.width = `${percent}%`;
          progressText.textContent = `${percent}%`;
          progressText.textContent = `${completed}/${total} uploaded`;
        } catch (error) {
          console.error('Upload failed:', error);
          alert(`Failed to upload ${photo.file.name}: ${error.message}`);
        }
      }

      // Success message
      document.getElementById('uploadStatus').textContent = `✓ ${completed}/${total} photos uploaded successfully`;
      this.photos = [];
      document.getElementById('uploadProgress').style.display = 'none';

      // Reload photos list
      await this.loadPhotos();
    } catch (error) {
      console.error('Upload error:', error);
      document.getElementById('uploadStatus').textContent = `✗ Upload failed: ${error.message}`;
    } finally {
      this.uploadInProgress = false;
      document.getElementById('uploadBtn').disabled = false;
    }
  }

  async loadPhotos() {
    try {
      const { data, error } = await this.supabase
        .from('photos')
        .select('*')
        .eq('unit_id', this.unitId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        document.getElementById('gallerySection').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        return;
      }

      // Display existing photos
      const gallery = document.getElementById('photoGallery');
      if (!gallery) {
        const section = document.getElementById('gallerySection');
        if (section) section.style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';
      }

      this.renderExistingPhotos(data);
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  }

  renderExistingPhotos(photos) {
    const gallery = document.getElementById('photoGallery');
    if (!gallery) return;

    const baseUrl = 'https://storage.googleapis.com/orp-storage'; // Supabase public URL
    const cdnUrl = `${baseUrl}/`;

    gallery.innerHTML = photos
      .map((photo, i) => `
        <div class="photo-item existing">
          <img src="${cdnUrl}${photo.storage_path}" alt="${photo.alt_text || 'Property photo'}" onerror="this.src='/images/placeholder.jpg'">
          <div class="photo-controls">
            ${photo.is_primary ? '<span class="badge badge-primary">Primary</span>' : ''}
            <button class="photo-btn delete-btn" data-photo-id="${photo.id}" title="Delete">×</button>
          </div>
        </div>
      `)
      .join('');

    // Attach delete handlers
    gallery.querySelectorAll('[data-photo-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Delete this photo?')) {
          await this.deletePhoto(btn.dataset.photoId);
        }
      });
    });

    document.getElementById('gallerySection').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
  }

  async deletePhoto(photoId) {
    try {
      const { error } = await this.supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      await this.loadPhotos();
      document.getElementById('uploadStatus').textContent = '✓ Photo deleted';
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Delete failed: ${error.message}`);
    }
  }
}
