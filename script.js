///@ts-check
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
let ac = new window.AudioContext()
let harm
let w //wiewport width
let h //wiewport height
let time //time from script beginning
const init = Date.now()
let harmoCount = 14
const pi = Math.PI
let pick = null
let finger = null
let ctrl = false
let pageY
let pressed = false

function panic() {
  ac.close()
  ac = new window.AudioContext()
}

function mod(n, m) {
  return n - m * Math.floor(n / m)
}

document.querySelector('.panic').addEventListener('click', panic)

function nthRoot(x = 0, r = 1) {
  if (x < 0) {
    if (r % 2 === 1) return -nthRoot(-x, r)
    if (r % 2 === -1) return -1 / nthRoot(-x, -r)
  }
  return x ** (1 / r)
}

class Curve extends Float32Array {
  constructor(n_samples = 2 ** 12 - 1, pickupX = 0.2, pickupY = 0.2) {
    super(n_samples)
    this._pickupX = pickupX
    this._pickupY = pickupY
    this.update()
  }

  get pickupX() {
    return this._pickupX
  }
  set pickupX(x) {
    this._pickupX = x
    this.update()
  }
  get pickupY() {
    return this._pickupY
  }
  set pickupY(y) {
    this._pickupX = y
    this.update()
  }
  update() {
    const n_samples = this.length
    for (let i = 0; i < n_samples; ++i) {
      const y = (i * 2) / (n_samples - 1) - 1
      this[i] = Math.hypot(this._pickupX, y - this._pickupY)
      //this[i] = nthRoot(y, 3)
      //this[i] = y
    }
    this.normalizeCurve()
  }

  // +3 +4 +5 +7 +9
  // -2 -1  0 +2 +5
  normalizeCurve() {
    const center = this[Math.floor(this.length / 2)]
    const min = Math.min(...this) - center
    const max = Math.max(...this) - center

    const amp = Math.abs(max) > Math.abs(min) ? max : min
    for (let i = 0; i < this.length; i++) {
      const v = this[i]
      this[i] = (v - center) / amp
    }
  }
}

const curve = new Curve()

/**
 * @param {AudioNode} dest
 */
function harmoNote(
  frq = 440,
  vol = 1,
  time = ac.currentTime,
  duration = 2,
  dest = ac.destination,
) {
  if (inputs.antialiasing && frq > 22050) return
  const osc = ac.createOscillator()
  osc.type = inputs.waveform
  osc.frequency.value = frq
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(dest)
  gain.gain.setValueAtTime(Math.abs(vol), ac.currentTime)
  // gain.gain.setValueAtTime(Math.abs(vol), time)
  gain.gain.exponentialRampToValueAtTime(0.00001, time + duration * 2)
  osc.onended = () => osc.disconnect()
  osc.start(time)
  osc.stop(time + duration * 2)
}
/**
 * @param {AudioNode} dest
 */
function oscillator(
  freq = 440,
  time = ac.currentTime,
  duration = 2,
  harmo = [1],
  dest = ac.destination,
) {
  if (inputs.pickup) {
    const preGain = ac.createGain()
    const pickup = ac.createWaveShaper()
    const postGain = ac.createGain()
    const gain = inputs.pickupGain
    preGain.gain.value = gain
    pickup.curve = curve
    postGain.gain.value = gain ? 1 / gain : 0

    preGain.connect(pickup)
    pickup.connect(postGain)
    postGain.connect(dest)
    dest = preGain
  }
  const freqMul = []
  for (let i = 1; i < harmo.length; i++) {
    const v = harmo[i]
    const fm = i ** inputs.inharmonicity
    freqMul.push(Math.round(fm*1e5)/1e5)
    harmoNote(
      freq * fm,
      0.15 / i ** 0.75,
      time,
      (inputs.length ** 1.5 * duration * v) / i ** (1 / inputs.mul ** 2),
      dest,
    )
  }
  console.table(freqMul)
}
function chord(
  chordNotes = [Math.floor(Math.random() * 6) * 4],
  dest = ac.destination,
) {
  for (const i in chordNotes) {
    const note = chordNotes[i]
    const frq = 55 * 2 ** (note / 12)
    oscillator(frq, ac.currentTime + (+i * 1) / 5, (60 * 110) / frq, harm, dest)
    //oscillator(frq, ac.currentTime + 1.5 + i*1/30, 12*110/frq, harm)
  }
}

const inputs = {}
{
  Array.from(document.querySelectorAll('.ctrl input, .ctrl select')).forEach(
    (input) => {
      if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) return
      const name = input.name
      let change
      if (input instanceof HTMLSelectElement) {
        change = () => {
          inputs[name] = input.value
        }
      } else 
        if (input.type === 'checkbox') {
        change = () => {
          inputs[name] = input.checked
        }
      } else {
        const initial = input.dataset.initial ?? input.value
        input.addEventListener('dblclick', () => change(input.value = initial))
        const span = input.parentElement.querySelector('span')
        change = () => {
          span.textContent = (inputs[name] = +input.value).toFixed(3)
        }
        const def = input.dataset.default
        if (def != null) input.addEventListener('dblclick', () => input)
      }

      input.addEventListener('input', change)
      change()
    },
  )
}

canvas.addEventListener('mousedown', (e) => {
  ac.resume()
  if (e && 'pageY' in e) {
    pageY = e.pageY
  }
  const pos = Math.floor(50 * (1 - pageY / h) - 15)
  const oct = Math.floor(pos / 7)
  const note = [0, 2, 3, 5, 7, 8, 10][mod(pos, 7)]
  //console.log(oct, note)
  chord([note + oct * 12])
})

window.addEventListener('keydown', (e) => {
  if (e.which === 32) {
    // space
    if (!pressed) {
      pressed = true
      canvas.dispatchEvent(new Event('mousedown'))
    }
    return
  }
  if (e.which === 27) {
    // esc
    panic()
    return
  }
  if (e.which !== 17) {
    // ctrl
    return
  }
  ctrl = true
})
window.addEventListener('keyup', (e) => {
  if (e.which === 32) {
    pressed = false
    return
  }
  if (e.which !== 17) {
    return
  }
  ctrl = false
})

function wheel(e) {
  e.preventDefault()
  harmoCount += Math.sign(e.deltaY)
  harmoCount = Math.max(1, harmoCount)
  draw()
}

function mousemove(e) {
  if (e.pageX <= 0 || e.pageX >= w - 1) return mouseout(e)
  pageY = e.pageY
  if (e.ctrlKey) {
    finger = e.pageX / w
    ctrl = true
  } else {
    pick = e.pageX / w
    ctrl = false
  }
  draw()
}

function mouseout(e) {
  if (e.ctrlKey) {
    finger = null
    ctrl = true
  } else {
    pick = null
    ctrl = false
  }
  draw()
}
window.addEventListener('mousemove', mousemove)
window.addEventListener('mouseout', mouseout)

window.addEventListener('wheel', wheel)

function draw() {
  clear()
  for (let i = 1; i <= 24; i++) {
    const i12 = i % 12
    ctx.beginPath()
    if (i12 === 0) ctx.strokeStyle = '#d0d'
    else if (i12 === 5 || i12 === 7) ctx.strokeStyle = '#c0c'
    else ctx.strokeStyle = '#808'
    const x = Math.round(w - w / 2 ** (i / 12))
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  harm = []
  ctx.lineWidth = Math.max(1, h / harmoCount / 30)
  for (let i = 1; i <= harmoCount; i++) {
    const step = Math.min(w / 20, Math.max(2, w / i / 10))
    let mul =
      finger == null
        ? 1
        : 1 -
          Math.min(1, 3 * Math.pow(Math.abs(Math.sin(finger * i * pi)), 1.5))
    // const mul = ctrl ? 1 : (1 - Math.sqrt(Math.abs(Math.sin(pick * i / w * pi))))
    mul *= pick == null ? 1 : ctrl ? 1 : Math.sin(pick * i * pi)
    // mul /= Math.sqrt(i)
    harm[i] = Math.abs(mul)
    ctx.strokeStyle = 'rgba(255,255,255,.2)'
    ctx.fillStyle = 'rgba(255,255,255,.02)'
    ctx.beginPath()
    ctx.moveTo(0, (h * (i - 0.5)) / harmoCount)
    for (let x = 0; x < w; x += step) {
      const y = Math.sin(((x * i) / w) * pi) * 0.4
      ctx.lineTo(x, (h * (i - 0.5 + y)) / harmoCount)
    }
    for (let x = w; x > 0; x -= step) {
      const y = Math.sin(((x * i) / w) * pi) * 0.4
      ctx.lineTo(x, (h * (i - 0.5 - y)) / harmoCount)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.fill()

    ctx.strokeStyle = 'white'
    ctx.fillStyle = 'rgba(255,255,255,.1)'
    ctx.beginPath()
    ctx.moveTo(0, (h * (i - 0.5)) / harmoCount)
    for (let x = 0; x < w; x += step) {
      const y = Math.sin(((x * i) / w) * pi) * 0.4 * mul
      ctx.lineTo(x, (h * (i - 0.5 + y)) / harmoCount)
    }
    for (let x = w; x > 0; x -= step) {
      const y = Math.sin(((x * i) / w) * pi) * 0.4 * mul
      ctx.lineTo(x, (h * (i - 0.5 - y)) / harmoCount)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.fill()
  }
  if (pick != null && !ctrl) {
    ctx.fillStyle = 'red'
    ctx.fillRect(pick * w, 0, 1, h)
  }
  if (finger != null) {
    ctx.fillStyle = 'yellow'
    ctx.fillRect(finger * w, 0, 1, h)
  }
}

function clear() {
  const oldFillStyle = ctx.fillStyle
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = oldFillStyle
}

function resize() {
  w = window.innerWidth
  h = window.innerHeight
  canvas.width = w
  canvas.height = h
  draw()
}

window.addEventListener('resize', resize)
resize()

document.body.appendChild(canvas)
