// Group A: index.html, tenant-placement.html, leave-review.html
module.exports = {
  content: ['../index.html', '../tenant-placement.html', '../leave-review.html'],
  theme: {
    extend: {
      colors: {
        plug: {
          blue:      '#0ea5e9',
          blueLight: '#7dd3fc',
          blueDark:  '#0369a1',
          sky:       '#bae6fd',
          skyDark:   '#7dd3fc',
          gold:      '#c9a84c',
          goldLight: '#e0be72',
          dark:      '#2e3d4e',
          card:      '#304052',
          border:    '#2c455a',
          muted:     '#8ba5b5',
        }
      },
      fontFamily: {
        sans:  ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      }
    }
  }
};
