export interface StateConfig<S> {
  frames: number[]  // 0-basierte Frame-Indizes im Sprite-Sheet
  fps: number
  loop: boolean
  next?: S          // Ziel-State nach Ende bei loop:false
}
