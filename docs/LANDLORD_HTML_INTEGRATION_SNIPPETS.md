# Exact HTML Snippets to Add to landlord.html

## 1. Add CSS Links (in `<head>` section)

Find the `<head>` tag and add these lines after any existing stylesheet links:

```html
<!-- Photo Uploader Styles -->
<link rel="stylesheet" href="/js/components/photo-uploader.css">
```

**Location Example:**
```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leasing Agent Dashboard</title>
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <!-- ... other head content ... -->
  
  <!-- ADD HERE ↓ -->
  <link rel="stylesheet" href="/js/components/photo-uploader.css">
  <!-- ADD HERE ↑ -->
  
  <style>
    /* existing styles ... */
  </style>
</head>
```

---

## 2. Add Script Links (before closing `</body>`)

Find the closing `</body>` tag and add these lines BEFORE it:

```html
<!-- Syndication Components -->
<script src="/js/components/PhotoUploader.js"></script>
<script src="/js/components/SyndicationManager.js"></script>
```

**Location Example:**
```html
  <!-- ... existing scripts ... -->
  <script src="/js/supabase-client.js"></script>
  
  <!-- ADD HERE ↓ -->
  <script src="/js/components/PhotoUploader.js"></script>
  <script src="/js/components/SyndicationManager.js"></script>
  <!-- ADD HERE ↑ -->
  
</body>
```

---

## 3. Add Container Divs to Vacancy Drawer

Find the vacancy drawer `.drawer-body` section. It should look like:

```html
<div class="drawer-backdrop" id="drawerBackdrop"></div>
<div class="drawer" id="drawer">
  <div class="drawer-head">
    <!-- drawer header ... -->
  </div>
  <div class="drawer-body">
    <!-- ADD NEW SECTIONS HERE -->
  </div>
</div>
```

Add these two sections to the `.drawer-body`:

```html
<!-- PHOTO UPLOADER SECTION -->
<div class="drawer-section">
  <div class="drawer-section-title">Property Photos</div>
  <div id="photoUploaderContainer"></div>
</div>

<!-- SYNDICATION STATUS SECTION -->
<div class="drawer-section">
  <div class="drawer-section-title">Listing Syndication</div>
  <div id="syndicationStatusContainer"></div>
</div>
```

**Complete Example:**
```html
<div class="drawer" id="drawer">
  <div class="drawer-head">
    <div>
      <div class="drawer-name" id="drawerName">Vacancy Details</div>
      <div class="drawer-meta" id="drawerMeta"></div>
    </div>
    <button class="drawer-close" onclick="closeDrawer()">×</button>
  </div>
  
  <div class="drawer-body">
    <!-- EXISTING SECTIONS ... -->
    
    <!-- PHOTO UPLOADER SECTION -->
    <div class="drawer-section">
      <div class="drawer-section-title">Property Photos</div>
      <div id="photoUploaderContainer"></div>
    </div>

    <!-- SYNDICATION STATUS SECTION -->
    <div class="drawer-section">
      <div class="drawer-section-title">Listing Syndication</div>
      <div id="syndicationStatusContainer"></div>
    </div>
  </div>
</div>
```

---

## 4. Add JavaScript Initialization Code

Find the function that opens the vacancy drawer. It's likely called `openDrawer()` or similar. Add this code inside that function, after the vacancy details are populated:

```javascript
async function openDrawer(vacancyData) {
  // ... existing code to populate vacancy details ...
  
  // Get the unit ID (adjust based on your data structure)
  const unitId = vacancyData.id || vacancyData.unit_id;
  
  if (!unitId) {
    console.error('No unit ID provided');
    return;
  }

  // Initialize Photo Uploader
  try {
    const uploader = new PhotoUploader('photoUploaderContainer', sb, unitId);
    await uploader.init();
    console.log('✓ Photo uploader initialized');
  } catch (error) {
    console.error('Error initializing photo uploader:', error);
  }

  // Initialize Syndication Manager
  try {
    const syndication = new SyndicationManager('syndicationStatusContainer', unitId);
    await syndication.init();
    console.log('✓ Syndication manager initialized');
  } catch (error) {
    console.error('Error initializing syndication manager:', error);
  }
}
```

**If you don't have a vacancy drawer yet**, add this new function:

```javascript
function openVacancyDrawer(unitId) {
  // Initialize Photo Uploader
  const uploader = new PhotoUploader('photoUploaderContainer', sb, unitId);
  uploader.init();

  // Initialize Syndication Manager
  const syndication = new SyndicationManager('syndicationStatusContainer', unitId);
  syndication.init();

  // Show the drawer
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}
```

---

## 5. Add Click Handler to Vacancy Cards

When you render vacancy cards, make them clickable:

```html
<!-- In your vacancy grid rendering code: -->
<div class="vacancy-card" onclick="openVacancyDrawer('${unitId}')">
  <!-- card content ... -->
</div>
```

Or if using JavaScript event listeners:

```javascript
// Add event listener to vacancy card
document.querySelectorAll('.vacancy-card').forEach(card => {
  card.addEventListener('click', function() {
    const unitId = this.dataset.unitId;
    openVacancyDrawer(unitId);
  });
});
```

---

## Complete Working Example

Here's a complete minimal example you can use:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Landlord Dashboard</title>
  <!-- ADD THIS LINE -->
  <link rel="stylesheet" href="/js/components/photo-uploader.css">
  <style>
    .drawer-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .07em;
      color: #64748b;
      margin-bottom: 10px;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <!-- Main content -->
  <div class="content">
    <div class="vacancy-grid" id="vacancyGrid"></div>
  </div>

  <!-- Drawer -->
  <div class="drawer-backdrop" id="drawerBackdrop"></div>
  <div class="drawer" id="drawer">
    <div class="drawer-head">
      <div>
        <div class="drawer-name" id="drawerName">Vacancy Details</div>
      </div>
      <button class="drawer-close" onclick="closeDrawer()">×</button>
    </div>
    <div class="drawer-body">
      <!-- PHOTO UPLOADER -->
      <div class="drawer-section">
        <div class="drawer-section-title">Property Photos</div>
        <div id="photoUploaderContainer"></div>
      </div>

      <!-- SYNDICATION -->
      <div class="drawer-section">
        <div class="drawer-section-title">Listing Syndication</div>
        <div id="syndicationStatusContainer"></div>
      </div>
    </div>
  </div>

  <!-- ADD THESE SCRIPT TAGS -->
  <script src="/js/components/PhotoUploader.js"></script>
  <script src="/js/components/SyndicationManager.js"></script>
  <!-- ADD ABOVE SCRIPTS -->

  <script>
    // Supabase client (should already exist)
    const sb = window.supabase.createClient(
      'https://lvmsajsvkmwejggecehp.supabase.co',
      'sb_publishable_ktgQ1_bHcK4J5rpAEZ-l_w_dqC9N144'
    );

    function openVacancyDrawer(unitId) {
      document.getElementById('drawerName').textContent = 'Unit: ' + unitId;
      
      // Initialize Photo Uploader
      const uploader = new PhotoUploader('photoUploaderContainer', sb, unitId);
      uploader.init();

      // Initialize Syndication Manager
      const syndication = new SyndicationManager('syndicationStatusContainer', unitId);
      syndication.init();

      // Show drawer
      document.getElementById('drawer').classList.add('open');
      document.getElementById('drawerBackdrop').classList.add('open');
    }

    function closeDrawer() {
      document.getElementById('drawer').classList.remove('open');
      document.getElementById('drawerBackdrop').classList.remove('open');
    }

    // Example: Render vacancy cards
    const vacancies = [
      { id: '123', beds: 2, price: 1800, address: '123 Main St' },
      { id: '456', beds: 3, price: 2200, address: '456 Oak Ave' }
    ];

    const grid = document.getElementById('vacancyGrid');
    grid.innerHTML = vacancies
      .map(v => `
        <div class="vacancy-card" onclick="openVacancyDrawer('${v.id}')">
          <div>${v.beds}BR - $${v.price}</div>
          <div>${v.address}</div>
        </div>
      `)
      .join('');
  </script>
</body>
</html>
```

---

## Step-by-Step Checklist

- [ ] **Step 1:** Add CSS link in `<head>`
- [ ] **Step 2:** Add script links before `</body>`
- [ ] **Step 3:** Add photo uploader container div to drawer
- [ ] **Step 4:** Add syndication status container div to drawer
- [ ] **Step 5:** Add initialization code to drawer open function
- [ ] **Step 6:** Test: Open vacancy drawer → should see upload area + sync buttons
- [ ] **Step 7:** Test: Upload a photo → should appear in gallery
- [ ] **Step 8:** Test: Click "Sync Now" → status should update

---

## Troubleshooting

### "PhotoUploader is not defined"
- ✗ Script tag not added before `</body>`
- ✓ Add: `<script src="/js/components/PhotoUploader.js"></script>`

### "sb is not defined"
- ✗ Supabase client not initialized
- ✓ Add: `const sb = window.supabase.createClient(...)`

### Photos not uploading
- ✗ Storage bucket not created
- ✓ Create in Supabase: Storage → New Bucket → Name: `orp-photos` → Public: ✓

### Containers not showing
- ✗ Container div IDs don't match
- ✓ Check: `photoUploaderContainer` and `syndicationStatusContainer` are correct

### Drawer not opening
- ✗ `openVacancyDrawer()` function missing
- ✓ Add the function from Step 5 above

---

## CSS Classes You May Need

If your existing CSS doesn't define these, add to your `<style>`:

```css
.drawer { display: none; }
.drawer.open { display: block; }
.drawer-backdrop { display: none; }
.drawer-backdrop.open { display: block; }
.drawer-section { margin-top: 20px; }
```

---

## File Paths to Verify

Make sure these files exist in your project:

```
✓ js/components/PhotoUploader.js
✓ js/components/SyndicationManager.js
✓ js/components/photo-uploader.css
✓ js/supabase-client.js (already exists)
✓ netlify/functions/syndicate.js
✓ netlify/functions/webhooks/realtor-ca-webhook.js
```

---

**Ready to copy-paste! Just follow the 5 sections above in order.** 🚀
