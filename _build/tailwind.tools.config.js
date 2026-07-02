// Group B (tw-tools.css): every page that loads tw-tools.css must be listed here,
// or its utility classes get purged from the build.
module.exports = {
  content: [
    '../property-management.html',
    '../am-i-overpaying.html',
    '../apply.html',
    '../rental-estimate.html',
  ],
  theme: {
    extend: {
      colors: {
        plug: {
          blue:      '#0284c7',
          blueLight: '#38bdf8',
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
