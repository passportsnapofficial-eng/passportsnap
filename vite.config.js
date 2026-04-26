import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { networkInterfaces } from 'node:os'
import { resolve } from 'node:path'

function isPrivateLanAddress(address) {
  return (
    address.startsWith('10.') ||
    address.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  )
}

function getAddressPriority(address) {
  if (address.startsWith('192.168.')) {
    return 3
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
    return 2
  }

  if (address.startsWith('10.')) {
    return 1
  }

  return isPrivateLanAddress(address) ? 0 : -1
}

function getDefaultHmrHost() {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)

  if (!addresses.length) {
    return 'localhost'
  }

  return addresses.sort((left, right) => getAddressPriority(right) - getAddressPriority(left) || left.localeCompare(right))[0]
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PAYMENTS_SERVER_PORT || '8790'
  const devHost = env.VITE_DEV_HOST || '0.0.0.0'
  const hmrHost =
    env.VITE_HMR_HOST ||
    (devHost === '0.0.0.0' || devHost === '::' ? getDefaultHmrHost() : devHost)

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: [
          resolve(process.cwd(), 'index.html'),
          resolve(process.cwd(), 'validation-lab.html'),
          resolve(process.cwd(), 'src/workers/passportValidationCompat.js'),
        ],
        output: {
          minifyInternalExports: false,
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === 'passportValidationCompat'
              ? 'assets/passportValidationCompat.js'
              : 'assets/[name]-[hash].js',
          manualChunks(id) {
            if (id.includes('@mediapipe')) return 'mediapipe';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react';
            if (id.includes('/components/admin/') || id.includes('/lib/admin/')) return 'admin';
          },
        },
      },
    },
    server: {
      host: devHost,
      port: 5173,
      strictPort: true,
      hmr: {
        host: hmrHost,
        clientPort: Number(env.VITE_HMR_PORT || 5173),
      },
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
