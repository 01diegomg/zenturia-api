/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.{html,js}',
  ],
  theme: {
    extend: {
      // Colores personalizados usando CSS variables
      colors: {
        accent: {
          DEFAULT: 'var(--dorado-vintage)',
          hover: 'var(--acento-hover)',
        },
        surface: {
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          elevated: 'var(--surface-elevated)',
        },
        semantic: {
          success: {
            DEFAULT: 'var(--color-success-500)',
            light: 'var(--color-success-400)',
            dark: 'var(--color-success-600)',
          },
          warning: {
            DEFAULT: 'var(--color-warning-500)',
            light: 'var(--color-warning-400)',
            dark: 'var(--color-warning-600)',
          },
          error: {
            DEFAULT: 'var(--color-error-500)',
            light: 'var(--color-error-400)',
            dark: 'var(--color-error-600)',
          },
          info: {
            DEFAULT: 'var(--color-info-500)',
            light: 'var(--color-info-400)',
            dark: 'var(--color-info-600)',
          },
        },
      },
      // Tipografía fluida
      fontSize: {
        'fluid-xs': 'var(--font-size-xs)',
        'fluid-sm': 'var(--font-size-sm)',
        'fluid-base': 'var(--font-size-base)',
        'fluid-lg': 'var(--font-size-lg)',
        'fluid-xl': 'var(--font-size-xl)',
        'fluid-2xl': 'var(--font-size-2xl)',
        'fluid-3xl': 'var(--font-size-3xl)',
        'fluid-4xl': 'var(--font-size-4xl)',
        'fluid-hero': 'var(--font-size-hero)',
      },
      // Line heights
      lineHeight: {
        'tight': 'var(--line-height-tight)',
        'snug': 'var(--line-height-snug)',
        'normal': 'var(--line-height-normal)',
        'relaxed': 'var(--line-height-relaxed)',
        'loose': 'var(--line-height-loose)',
      },
      // Espaciado
      spacing: {
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        '3xl': 'var(--spacing-3xl)',
      },
      // Border radius
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      // Box shadows
      boxShadow: {
        'glow': 'var(--shadow-glow)',
        'glow-strong': 'var(--shadow-glow-strong)',
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
      },
      // Transiciones
      transitionTimingFunction: {
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '300ms',
        'slow': '500ms',
      },
      // Border colors
      borderColor: {
        'subtle': 'var(--border-subtle)',
        'medium': 'var(--border-medium)',
        'accent': 'var(--border-accent)',
        'accent-strong': 'var(--border-accent-strong)',
      },
      // Animaciones personalizadas
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'scale-in': 'scaleIn 0.4s ease-out',
        'pulse-glow': 'glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(50px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(207, 175, 124, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(207, 175, 124, 0.8)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
}
