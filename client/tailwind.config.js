/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        nintendo: {
          red: '#E60012',
          blue: '#0068B7',
          yellow: '#FFC907',
          green: '#00A651',
          pink: '#FF6B9D',
          purple: '#8B5CF6',
          orange: '#FF8C00',
          sky: '#87CEEB',
          cream: '#FFF8E7',
          dark: '#2D1B69',
        }
      },
      fontFamily: {
        display: ['"Fredoka"', 'sans-serif'],
        body: ['"Nunito"', 'sans-serif'],
      },
      animation: {
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68,-0.55,0.265,1.55)',
        'slide-up': 'slideUp 0.4s ease-out',
        'pop': 'pop 0.3s cubic-bezier(0.68,-0.55,0.265,1.55)',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'rainbow': 'rainbow 3s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'confetti': 'confetti 1s ease-out forwards',
        'letter-spin': 'letterSpin 0.8s cubic-bezier(0.68,-0.55,0.265,1.55)',
        'countdown-pop': 'countdownPop 0.8s ease-out',
      },
      keyframes: {
        bounceIn: { '0%': { transform: 'scale(0) rotate(-10deg)', opacity: '0' }, '60%': { transform: 'scale(1.15) rotate(2deg)' }, '100%': { transform: 'scale(1) rotate(0)', opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(30px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pop: { '0%': { transform: 'scale(0.5)', opacity: '0' }, '80%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        wiggle: { '0%,100%': { transform: 'rotate(0)' }, '25%': { transform: 'rotate(-5deg)' }, '75%': { transform: 'rotate(5deg)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 5px rgba(230,0,18,0.3)' }, '50%': { boxShadow: '0 0 25px rgba(230,0,18,0.6), 0 0 50px rgba(230,0,18,0.3)' } },
        rainbow: { '0%': { filter: 'hue-rotate(0deg)' }, '100%': { filter: 'hue-rotate(360deg)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-8px)' }, '75%': { transform: 'translateX(8px)' } },
        letterSpin: { '0%': { transform: 'scale(4) rotate(-180deg)', opacity: '0' }, '60%': { transform: 'scale(1.2) rotate(10deg)' }, '100%': { transform: 'scale(1) rotate(0)', opacity: '1' } },
        countdownPop: { '0%': { transform: 'scale(4)', opacity: '0' }, '50%': { transform: 'scale(1.1)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
      }
    },
  },
  plugins: [],
};
