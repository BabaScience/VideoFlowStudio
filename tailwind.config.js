// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx}', './index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode colors
        light: {
          primary: '#007AFF',
          secondary: '#5856D6',
          success: '#34C759',
          warning: '#FF9500',
          error: '#FF3B30',
          bg: {
            primary: '#FFFFFF',
            secondary: '#F5F5F7',
            tertiary: '#EFEFF4',
          },
          text: {
            primary: '#000000',
            secondary: '#3C3C43',
            tertiary: '#8E8E93',
          },
          border: '#D1D1D6',
          divider: '#E5E5EA',
        },
        // Dark mode colors
        dark: {
          primary: '#0A84FF',
          secondary: '#5E5CE6',
          success: '#32D74B',
          warning: '#FF9F0A',
          error: '#FF453A',
          bg: {
            primary: '#1C1C1E',
            secondary: '#2C2C2E',
            tertiary: '#3A3A3C',
          },
          text: {
            primary: '#FFFFFF',
            secondary: '#EBEBF5',
            tertiary: '#A1A1A6',
          },
          border: '#38383A',
          divider: '#48484A',
        },
      },
      fontFamily: {
        system: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'sans-serif',
        ],
        mono: ['"SF Mono"', '"Menlo"', '"Monaco"', 'monospace'],
      },
      fontSize: {
        xs: '11px',
        sm: '13px',
        base: '15px',
        lg: '17px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '28px',
        '4xl': '34px',
      },
      spacing: {
        0: '0',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 12px 0 rgba(0, 0, 0, 0.1)',
        lg: '0 8px 24px 0 rgba(0, 0, 0, 0.15)',
        xl: '0 12px 32px 0 rgba(0, 0, 0, 0.2)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.glass': {
          'background-color': 'rgba(255, 255, 255, 0.7)',
          'backdrop-filter': 'blur(10px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(10px) saturate(180%)',
        },
        '.glass-dark': {
          'background-color': 'rgba(28, 28, 30, 0.7)',
          'backdrop-filter': 'blur(10px) saturate(180%)',
          '-webkit-backdrop-filter': 'blur(10px) saturate(180%)',
        },
        '.no-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.custom-scrollbar': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            'background-color': 'rgba(0, 0, 0, 0.2)',
            'border-radius': '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            'background-color': 'rgba(0, 0, 0, 0.3)',
          },
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
