// Configuración del CSS de la app. Antes Tailwind se cargaba desde cdn.tailwindcss.com y generaba
// los estilos en el navegador; si ese dominio no carga, la app sale sin diseño (pasó en un celular).
// Ahora tailwind.css se compila acá. Hay que regenerarlo cuando cambien clases en app.jsx o index.html:
//   npx --yes tailwindcss@3.4.17 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
// (netlify.toml lo corre solo en cada build de Netlify.)
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './app.jsx'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        app: {
          base: 'var(--color-bg-base)',
          surface: 'var(--color-bg-surface)',
          elevated: 'var(--color-bg-elevated)',
          card: 'var(--color-bg-card)',
          modal: 'var(--color-bg-modal)',
          text: 'var(--color-text-main)',
          muted: 'var(--color-text-muted)',
          border: 'var(--color-border-card)',
          emerald: 'var(--color-emerald-main)',
          'emerald-bg': 'var(--color-emerald-bg)',
          navy: 'var(--color-navy-main)',
          'navy-bg': 'var(--color-navy-bg)',
          amber: 'var(--color-amber-main)',
          'amber-bg': 'var(--color-amber-bg)',
          ruby: 'var(--color-ruby-main)',
          'ruby-bg': 'var(--color-ruby-bg)',
        },
      },
      borderRadius: {
        'xl': '20px',
        '2xl': '28px',
        '3xl': '36px',
      },
      boxShadow: {
        'fluffy': 'var(--shadow-fluffy)',
        'card': 'var(--shadow-card)',
        'emerald': 'var(--shadow-emerald)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
