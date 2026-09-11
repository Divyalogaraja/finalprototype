export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#070b14',
        panel: '#0c1322',
        edge: '#1c2a44',
        mut: '#8fa3c7',
        accent: '#4ea1ff',
        ok: '#3dd68c',
        warn: '#ffb454',
        danger: '#ff5d6c',
        crit: '#ff3b52',
        info: '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter','ui-sans-serif','system-ui','Segoe UI','sans-serif'],
        mono: ['"JetBrains Mono"','ui-monospace','SFMono-Regular','Menlo','monospace'],
      },
    },
  },
  plugins: [],
}
