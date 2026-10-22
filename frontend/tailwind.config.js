/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                // ─── Electric Blue / Cyan Theme ───
                'ev-cyan':    '#06b6d4',
                'ev-blue':    '#0ea5e9',
                'ev-amber':   '#f59e0b',
                'ev-red':     '#ef4444',
                // Legacy compat
                'neon-green': '#06b6d4',
                'neon-cyan':  '#38bdf8',
                'dark-900':   '#070d19',
                'dark-800':   '#0d1b2e',
                'dark-700':   '#1a2e45',
            },
            fontFamily: {
                sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            animation: {
                'slide-down': 'slideDown 0.2s ease-out',
                'fade-in':    'fadeIn 0.25s ease-out',
                'scale-in':   'scaleIn 0.2s ease-out',
            },
            keyframes: {
                slideDown: {
                    '0%':   { opacity: 0, transform: 'translateY(-8px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                fadeIn: {
                    '0%':   { opacity: 0 },
                    '100%': { opacity: 1 },
                },
                scaleIn: {
                    '0%':   { opacity: 0, transform: 'scale(0.96)' },
                    '100%': { opacity: 1, transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
}
