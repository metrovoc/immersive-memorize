import { ImmersiveMemorize } from './immersive-memorize'

// The background injects this script into every frame and may inject again after navigation.
const scope = window as Window & { immersiveMemorizeLoaded?: boolean }
if (!scope.immersiveMemorizeLoaded) {
  scope.immersiveMemorizeLoaded = true
  void new ImmersiveMemorize().start()
}
