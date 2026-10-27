import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // the 3D plan loads three.js on demand: pre-bundle it in dev so opening it doesn't reload the page
  optimizeDeps: {
    include: [
      'three',
      'three/addons/controls/OrbitControls.js',
      'three/addons/environments/RoomEnvironment.js',
      'three/addons/geometries/RoundedBoxGeometry.js',
      'three/addons/postprocessing/EffectComposer.js',
      'three/addons/postprocessing/OutputPass.js',
      'three/addons/postprocessing/RenderPass.js',
      'three/addons/postprocessing/ShaderPass.js',
      'three/addons/postprocessing/UnrealBloomPass.js',
      'three/addons/shaders/HorizontalTiltShiftShader.js',
      'three/addons/shaders/VerticalTiltShiftShader.js',
    ],
  },
})
