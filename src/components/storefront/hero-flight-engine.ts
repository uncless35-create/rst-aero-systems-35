/**
 * Движок анимации героя: дрон летает вокруг неоновой эмблемы и входит в неё.
 *
 * Сценарий (по референсу интро ANIKFPV): дрон вылетает из центра, проходит круг
 * по наклонённой орбите, втягивается по спирали обратно и входит в эмблему со
 * вспышкой — после чего эмблема горит с именем внутри. Дальше пролёт повторяется
 * раз в `CYCLE` секунд.
 *
 * Смаз движения — не фильтр, а длинная выдержка: дрон рисуется в нескольких
 * позициях назад по траектории (`EXPOSURE` / `SUBFRAMES`) с затуханием, в режиме
 * `lighter`. Поверх всего кадра идёт bloom-проход (уменьшенная копия + размытие),
 * который и даёт «рендерное» свечение вместо графики из чётких линий.
 *
 * След делится по глубине: сегменты с z > 0 рисуются ДО эмблемы, с z < 0 — ПОСЛЕ,
 * поэтому ленты обвивают её. Эмблема и отражение дороги в отрисовке, поэтому
 * готовятся один раз в offscreen-канвасы при resize.
 *
 * Модуль не знает про React и rAF: время двигает вызывающий код (`step`), что
 * позволяет прогонять анимацию детерминированно — в том числе для снятия кадров.
 */

const ACCENT = { r: 201, g: 242, b: 77 }; // --accent #c9f24d
const CORE = { r: 238, g: 255, b: 190 }; // осветлённый лайм — «перегретое» ядро

const FOCAL = 780; // фокусное расстояние псевдо-3D проекции
const SAMPLE = 0.025; // шаг сэмплирования следа, с
const CHUNK = 6; // сегментов следа в одном stroke

// Интро: дрон облетает саму надпись, затем надпись уезжает влево, а дрон
// перелетает вправо и складывается в эмблему. Дальше — повторяющиеся пролёты
// уже вокруг эмблемы. Тайминг перелёта совпадает с CSS-анимацией `.hero-settle`.
const INTRO_END = 4.6; // конец интро (момент входа дрона в эмблему), с
const HANDOFF: readonly [number, number] = [3.4, 4.5]; // перелёт от надписи к эмблеме
const INTRO_SHRINK: readonly [number, number] = [4.0, INTRO_END]; // схлопывание орбиты
const INTRO_FADE: readonly [number, number] = [4.25, INTRO_END]; // растворение дрона
const EMBLEM_FIRST: readonly [number, number] = [4.2, 5.0]; // первое разгорание неона
const NAME_IN: readonly [number, number] = [4.9, 5.7]; // проявление имени
const MASK_IN: readonly [number, number] = [3.6, 4.9]; // затенение слоя над текстом

const CYCLE = 12; // период повтора пролёта после интро, с
const REST_AFTER_INTRO = 7; // сколько дрон стоит в эмблеме, прежде чем вылететь снова
const ARRIVE = 3.95; // момент входа дрона в эмблему внутри повторного цикла, с
const FLY_OUT: readonly [number, number] = [0.05, 0.6]; // рывок из центра наружу
const FLY_IN: readonly [number, number] = [3.1, ARRIVE]; // возврат по спирали
const DRONE_FADE: readonly [number, number] = [3.6, ARRIVE]; // растворение в эмблеме
const FLASH_SIGMA = 0.17; // длительность вспышки при входе, с

// Орбита вокруг надписи заметно круглее экранного эллипса вокруг эмблемы,
// иначе облёт читается как полоска, а не как круг вокруг текста.
const TEXT_TILT = 1.05;

// Длинная выдержка: чем больше EXPOSURE, тем длиннее смаз дрона.
const EXPOSURE = 0.15; // «время открытого затвора», с
const SUBFRAMES = 10; // сколько копий дрона укладывается в этот интервал

const BLOOM_SCALE = 3; // во сколько раз уменьшается кадр для bloom-прохода
const BLOOM_BLUR = 2.6; // радиус размытия в пикселях уменьшенной копии
const BLOOM_GAIN = 0.32; // с какой силой bloom возвращается на кадр

const NAME = "RST AERO";
const DRONE_FLATTEN = 0.45; // вертикальное сжатие: смотрим на дрон сверху под углом
const ARMS = [-0.62, 0.62, Math.PI - 0.62, Math.PI + 0.62]; // X-рама, нос вправо

type OrbitSpec = {
  radius: number; // множитель от радиуса эмблемы
  tilt: number; // наклон плоскости орбиты, рад
  roll: number; // доворот эллипса на экране, рад
  speed: number; // угловая скорость, рад/с — за пролёт должен выйти ~круг
  phase: number;
  width: number;
  alpha: number;
  drone: boolean; // на этой орбите летит видимый дрон
};

const ORBITS: OrbitSpec[] = [
  { radius: 1.3, tilt: 1.42, roll: -0.33, speed: 1.9, phase: 0, width: 2.5, alpha: 1, drone: true },
  { radius: 1.06, tilt: 1.12, roll: 0.24, speed: 1.62, phase: 2.2, width: 1.9, alpha: 0.6, drone: false },
  { radius: 1.54, tilt: 1.34, roll: -0.06, speed: 1.45, phase: 4.1, width: 1.5, alpha: 0.45, drone: false },
];

/** Точка следа — уже в экранных координатах (без параллакса): центр орбиты
 *  переезжает от надписи к эмблеме, и лента должна оставаться там, где прошла. */
type TrailPoint = { x: number; y: number; z: number; s: number; t: number };

type Orbit = {
  spec: OrbitSpec;
  angle: number;
  trail: TrailPoint[];
  lastSample: number;
};

type Chunk = {
  pts: number[]; // плоский [x0,y0,x1,y1,…] в экранных координатах
  alpha: number;
  width: number;
  nx: number; // нормаль к среднему направлению — вдоль неё расходятся нити пучка
  ny: number;
};

/** Одна копия дрона в кадре длинной выдержки. */
type DroneSample = {
  x: number;
  y: number;
  scale: number;
  heading: number;
  alpha: number;
  z: number;
  spin: number;
  fresh: boolean; // самая свежая копия — единственная с ореолом
};

/** Прямоугольник текста, над которым свечение нужно погасить (CSS-пиксели). */
export type Shield = { x: number; y: number; w: number; h: number };

/** Смещения нитей пучка поперёк следа, в долях ширины ленты. */
const STRANDS = [0, -1.7, 2.1];

export type HeroFlightEngine = {
  /** Пересобрать сцену под новый размер контейнера (CSS-пиксели). */
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  /** Продвинуть время на dt секунд. */
  step(dt: number): void;
  /** Отрисовать текущее состояние. */
  draw(): void;
  /** Положение курсора в долях блока (0…1); за пределами — центр. */
  setPointer(nx: number, ny: number): void;
  /** Прямоугольники текста героя — над ними свечение гасится точечно. */
  setShields(boxes: Shield[]): void;
  /** Перемотать на нужный момент с нуля (детерминированно). */
  seek(seconds: number): void;
  /** Текущее время анимации, с. */
  age(): number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (edge0: number, edge1: number, v: number) => {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const rgba = (c: { r: number; g: number; b: number }, a: number) =>
  `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;

// Пропорции сняты с референса: кольца крупные, стороны вогнуты умеренно —
// центральная часть остаётся широкой, иначе силуэт читается как клевер.
const MOTOR_R = 0.36; // радиус кольца мотора, доля от r
const ARM_R = 0.68; // вынос мотора от центра
const WAIST = 0.3; // насколько глубоко сторона проваливается к центру
const SWEEP = 2.62; // половина дуги мотора, рад (~150°): кольцо почти замкнуто
const CORNERS = [-Math.PI / 4, Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4];

/** Контур квадрокоптера: четыре кольца моторов, соединённые вогнутой X-рамой. */
function emblemPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const motorR = r * MOTOR_R;
  const armR = r * ARM_R;
  const waist = r * WAIST;

  ctx.beginPath();
  for (let i = 0; i < CORNERS.length; i++) {
    const a = CORNERS[i];
    ctx.arc(cx + Math.cos(a) * armR, cy + Math.sin(a) * armR, motorR, a - SWEEP, a + SWEEP, false);

    const next = CORNERS[(i + 1) % CORNERS.length];
    const ctrl = a + Math.PI / 4; // биссектриса между соседними моторами
    ctx.quadraticCurveTo(
      cx + Math.cos(ctrl) * waist,
      cy + Math.sin(ctrl) * waist,
      cx + Math.cos(next) * armR + Math.cos(next - SWEEP) * motorR,
      cy + Math.sin(next) * armR + Math.sin(next - SWEEP) * motorR,
    );
  }
  ctx.closePath();
}

/** Лопасти внутри колец — капли остриём к центру, как в референсе. */
function bladesPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const motorR = r * MOTOR_R;
  const armR = r * ARM_R;

  ctx.beginPath();
  for (const a of CORNERS) {
    const mx = cx + Math.cos(a) * armR;
    const my = cy + Math.sin(a) * armR;
    // единичный вектор «к центру» и перпендикуляр к нему
    const dx = -Math.cos(a);
    const dy = -Math.sin(a);
    const nx = -dy;
    const ny = dx;

    const apexX = mx + dx * motorR * 0.85;
    const apexY = my + dy * motorR * 0.85;
    const farX = mx - dx * motorR * 0.42;
    const farY = my - dy * motorR * 0.42;
    const bulge = motorR * 0.54;

    ctx.moveTo(apexX, apexY);
    ctx.quadraticCurveTo(mx + nx * bulge, my + ny * bulge, farX, farY);
    ctx.quadraticCurveTo(mx - nx * bulge, my - ny * bulge, apexX, apexY);
  }
  ctx.closePath();
}

/**
 * Силуэт квадрокоптера: X-рама, диски винтов и бортовые огни.
 * Рисуется в сжатой по вертикали системе координат — вид сверху под углом,
 * поэтому дрон читается как летящий в плоскости орбиты, а не приклеенный к экрану.
 */
function drawDrone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  heading: number,
  alpha: number,
  spin: number,
  withHalo: boolean,
) {
  // ореол вокруг машины — только у свежей копии: на каждой копии выдержки
  // он сложился бы в сплошное световое пятно
  if (withHalo) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 2.4);
    halo.addColorStop(0, rgba(ACCENT, alpha * 0.32));
    halo.addColorStop(1, rgba(ACCENT, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, size * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, DRONE_FLATTEN);
  ctx.rotate(heading);
  ctx.scale(size, size);

  // лучи рамы
  ctx.lineCap = "round";
  ctx.lineWidth = 0.13;
  ctx.strokeStyle = rgba(ACCENT, alpha * 0.85);
  ctx.beginPath();
  for (const a of ARMS) {
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a), Math.sin(a));
  }
  ctx.stroke();

  // винты: размытый диск + светлая дуга бегущей лопасти
  ARMS.forEach((a, i) => {
    const mx = Math.cos(a);
    const my = Math.sin(a);
    ctx.fillStyle = rgba(ACCENT, alpha * 0.22);
    ctx.beginPath();
    ctx.arc(mx, my, 0.44, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 0.09;
    ctx.strokeStyle = rgba(CORE, alpha * 0.65);
    const from = spin * (i % 2 === 0 ? 1 : -1) + i * 1.7;
    ctx.beginPath();
    ctx.arc(mx, my, 0.44, from, from + 2.1);
    ctx.stroke();
  });

  // корпус
  ctx.fillStyle = rgba(CORE, alpha * 0.9);
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.42, 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // бортовые огни: нос ярко-белый, корма приглушённая
  ctx.fillStyle = rgba(CORE, alpha);
  ctx.beginPath();
  ctx.arc(0.42, 0, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(ACCENT, alpha * 0.8);
  ctx.beginPath();
  ctx.arc(-0.42, 0, 0.09, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function createHeroFlight(canvas: HTMLCanvasElement): HeroFlightEngine | null {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;

  // Safari < 16.4 не умеет ctx.filter — там обходимся без размытых проходов
  ctx.filter = "blur(1px)";
  const canFilter = ctx.filter !== "none";
  ctx.filter = "none";

  // имя в эмблеме набирается шрифтом сайта
  const fontFamily =
    (typeof getComputedStyle === "function" && getComputedStyle(canvas).fontFamily) ||
    "system-ui, sans-serif";

  let dpr = 1;
  let w = 0;
  let h = 0;
  let cx = 0;
  let cy = 0;
  let emblemR = 0;
  let textCX = 0; // центр надписи — вокруг него дрон идёт первый круг
  let textCY = 0;
  let textR = 0; // базовый радиус облёта надписи
  let maskEdge = 0.58; // докуда гасится общий фон над колонкой текста, доля ширины
  let shields: Shield[] = []; // прямоугольники строк текста — гасятся точечно
  let sceneAlpha = 1;
  let age = 0;

  let px = 0;
  let py = 0;
  let targetPX = 0;
  let targetPY = 0;

  const emblemCanvas = document.createElement("canvas");
  const reflectCanvas = document.createElement("canvas");
  const bloomCanvas = document.createElement("canvas");
  const REFLECT_SQUASH = 0.62; // вертикальное сжатие отражения
  let reflectTop = 0; // отступ от верха reflectCanvas до контура отражения

  const orbits: Orbit[] = ORBITS.map((spec) => ({
    spec,
    angle: spec.phase,
    trail: [],
    lastSample: -1,
  }));

  const back: Chunk[] = [];
  const front: Chunk[] = [];

  // Веса копий выдержки. Свежая копия держит силуэт почти в полную яркость,
  // прошлые складываются в смаз — поэтому вес падает резко, а не равномерно.
  const SUB_WEIGHTS = Array.from({ length: SUBFRAMES }, (_, i) =>
    i === 0 ? 0.8 : 0.3 * (1 - i / SUBFRAMES) ** 2,
  );

  /** Эмблема с многопроходным bloom и её отражение — в offscreen, один раз на размер. */
  const renderEmblem = () => {
    const pad = emblemR * 0.85;
    const size = Math.ceil((emblemR + pad) * 2);
    if (size <= 0) return;

    emblemCanvas.width = Math.ceil(size * dpr);
    emblemCanvas.height = Math.ceil(size * dpr);
    const ec = emblemCanvas.getContext("2d");
    if (!ec) return;
    ec.setTransform(dpr, 0, 0, dpr, 0, 0);
    ec.clearRect(0, 0, size, size);
    ec.globalCompositeOperation = "lighter";

    const mid = size / 2;

    const halo = ec.createRadialGradient(mid, mid, emblemR * 0.2, mid, mid, emblemR + pad);
    halo.addColorStop(0, rgba(ACCENT, 0.26));
    halo.addColorStop(0.45, rgba(ACCENT, 0.08));
    halo.addColorStop(1, rgba(ACCENT, 0));
    ec.fillStyle = halo;
    ec.fillRect(0, 0, size, size);

    // три прохода: мягкое свечение → неоновая трубка → белёсое ядро
    const passes = [
      { width: emblemR * 0.2, color: rgba(ACCENT, 0.11), blur: 16 },
      { width: emblemR * 0.055, color: rgba(ACCENT, 0.6), blur: 5 },
      { width: emblemR * 0.019, color: rgba(CORE, 0.85), blur: 0 },
    ];
    ec.lineJoin = "round";
    ec.lineCap = "round";
    for (const pass of passes) {
      ec.filter = canFilter && pass.blur > 0 ? `blur(${pass.blur * dpr}px)` : "none";
      ec.lineWidth = pass.width;
      ec.strokeStyle = pass.color;
      emblemPath(ec, mid, mid, emblemR);
      ec.stroke();
    }

    // лопасти внутри колец — заливка со своим ореолом
    ec.filter = canFilter ? `blur(${7 * dpr}px)` : "none";
    ec.fillStyle = rgba(ACCENT, 0.22);
    bladesPath(ec, mid, mid, emblemR);
    ec.fill();
    ec.filter = "none";
    ec.fillStyle = rgba(CORE, 0.5);
    bladesPath(ec, mid, mid, emblemR);
    ec.fill();

    // отражение: та же эмблема, перевёрнутая, сжатая и погашенная вниз
    const rh = Math.ceil(size * REFLECT_SQUASH);
    reflectTop = (size / 2 - emblemR) * REFLECT_SQUASH;
    reflectCanvas.width = Math.ceil(size * dpr);
    reflectCanvas.height = Math.ceil(rh * dpr);
    const rc = reflectCanvas.getContext("2d");
    if (!rc) return;
    rc.setTransform(dpr, 0, 0, dpr, 0, 0);
    rc.clearRect(0, 0, size, rh);
    rc.save();
    rc.translate(0, rh);
    rc.scale(1, -REFLECT_SQUASH);
    // отражение в глянце всегда мягче оригинала
    rc.filter = canFilter ? `blur(${2.5 * dpr}px)` : "none";
    rc.drawImage(emblemCanvas, 0, 0, size, size);
    rc.restore();
    rc.globalCompositeOperation = "destination-out";
    const fade = rc.createLinearGradient(0, 0, 0, rh);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(0.5, "rgba(0,0,0,0.7)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    rc.fillStyle = fade;
    rc.fillRect(0, 0, size, rh);
    rc.globalCompositeOperation = "source-over";
  };

  const resize = (cssWidth: number, cssHeight: number, ratio: number) => {
    if (cssWidth <= 0 || cssHeight <= 0) return;
    dpr = Math.min(2, ratio || 1);
    w = cssWidth;
    h = cssHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bloomCanvas.width = Math.max(1, Math.round(canvas.width / BLOOM_SCALE));
    bloomCanvas.height = Math.max(1, Math.round(canvas.height / BLOOM_SCALE));

    if (w < 720) {
      // узкий экран: текст занимает всю ширину, поэтому эмблема уходит
      // в правый верхний угол водяным знаком и частично срезается краем
      cx = w * 0.92;
      cy = h * 0.16;
      emblemR = Math.min(h * 0.16, w * 0.22);
      textCX = w * 0.5;
      textCY = h * 0.42;
      textR = Math.min(w * 0.42, h * 0.3);
      maskEdge = 0.2; // текст на всю ширину — гасить нечего
      sceneAlpha = 0.32;
    } else {
      // крупная эмблема правее колонки текста; чуть выше середины —
      // чтобы под ней поместилось отражение
      cx = w * 0.74;
      cy = h * 0.47;
      emblemR = Math.min(h * 0.32, w * 0.14);
      // на интро текст стоит сдвинутым вправо (CSS-класс .hero-settle),
      // поэтому центр облёта берём с тем же сдвигом
      textCX = w * 0.45;
      textCY = h * 0.5;
      textR = w * 0.26;
      maskEdge = 0.58;
      sceneAlpha = 0.92;
    }
    renderEmblem();
  };

  const isIntro = (t: number) => t < INTRO_END;
  /** Время внутри повторяющегося пролёта. Отсчёт сдвинут на `REST_AFTER_INTRO`,
   *  иначе дрон вылетал бы из эмблемы сразу после того, как в неё вошёл. */
  const loopTimeAt = (t: number) => {
    const x = t - INTRO_END - REST_AFTER_INTRO;
    return ((x % CYCLE) + CYCLE) % CYCLE;
  };

  /** 0 — дрон ещё вокруг надписи, 1 — уже вокруг эмблемы. */
  const handoffAt = (t: number) => (isIntro(t) ? smoothstep(HANDOFF[0], HANDOFF[1], t) : 1);

  /** Центр орбиты: на интро переезжает от надписи к месту эмблемы. */
  const centerAt = (t: number) => {
    const k = handoffAt(t);
    return { x: lerp(textCX, cx, k), y: lerp(textCY, cy, k) };
  };

  /**
   * Радиус орбиты. На интро — широкий круг вокруг надписи, который вместе с
   * переездом центра сжимается до эмблемного и схлопывается в точку входа.
   * В повторных циклах — вылет из эмблемы, круг, спираль обратно.
   */
  const orbitRadiusAt = (o: Orbit, t: number) => {
    const breathe = 1 + 0.02 * Math.sin(t * 0.7);
    if (isIntro(t)) {
      const base = lerp(textR, emblemR, handoffAt(t)) * o.spec.radius;
      return base * (1 - smoothstep(INTRO_SHRINK[0], INTRO_SHRINK[1], t)) * breathe;
    }
    const lt = loopTimeAt(t);
    const out = smoothstep(FLY_OUT[0], FLY_OUT[1], lt);
    const backIn = 1 - smoothstep(FLY_IN[0], FLY_IN[1], lt);
    return emblemR * o.spec.radius * out * backIn * breathe;
  };

  /** Наклон плоскости орбиты: вокруг надписи круг заметно круглее. */
  const tiltAt = (o: Orbit, t: number) =>
    lerp(TEXT_TILT, o.spec.tilt, handoffAt(t)) + py * 0.0016;

  /** Угол на орбите в момент `t` — скорость постоянна, поэтому просто откат назад. */
  const angleAt = (o: Orbit, t: number) => o.angle - o.spec.speed * (age - t);

  /** Экранная позиция дрона/следа в момент `t` (без параллакса). */
  const positionAt = (o: Orbit, t: number) => {
    const angle = angleAt(o, t);
    const radius = orbitRadiusAt(o, t);
    const tilt = tiltAt(o, t);
    const roll = o.spec.roll;
    const center = centerAt(t);

    const project = (ang: number) => {
      const x0 = Math.cos(ang) * radius;
      const y0 = Math.sin(ang) * radius;
      const y1 = y0 * Math.cos(tilt); // наклон плоскости вокруг оси X
      const z = y0 * Math.sin(tilt);
      const wx = x0 * Math.cos(roll) - y1 * Math.sin(roll);
      const wy = x0 * Math.sin(roll) + y1 * Math.cos(roll);
      const scale = FOCAL / (FOCAL + z);
      return { x: center.x + wx * scale, y: center.y + wy * scale, z, s: scale };
    };

    const here = project(angle);
    const ahead = project(angle + 0.05);
    return {
      ...here,
      heading: Math.atan2((ahead.y - here.y) / DRONE_FLATTEN, ahead.x - here.x),
    };
  };

  const buildChunks = (o: Orbit, life: number, intensity: number) => {
    const pts = o.trail;
    if (pts.length < 2) return;
    for (let start = 0; start < pts.length - 1; start += CHUNK) {
      const end = Math.min(pts.length - 1, start + CHUNK);
      const poly: number[] = [];
      let zSum = 0;
      let sSum = 0;
      for (let i = start; i <= end; i++) {
        const p = pts[i];
        poly.push(p.x + px * 0.6, p.y + py * 0.6);
        zSum += p.z;
        sSum += p.s;
      }
      const n = end - start + 1;
      const fade = clamp01(1 - (age - pts[(start + end) >> 1].t) / life);
      const a = fade * fade * o.spec.alpha * intensity * sceneAlpha;
      if (a < 0.004) continue;

      // нормаль к хорде чанка — поперёк неё расходятся нити пучка
      const dx = poly[poly.length - 2] - poly[0];
      const dy = poly[poly.length - 1] - poly[1];
      const len = Math.hypot(dx, dy) || 1;

      const chunk: Chunk = {
        pts: poly,
        alpha: a,
        width: o.spec.width * (0.4 + 0.6 * fade) * (sSum / n),
        nx: -dy / len,
        ny: dx / len,
      };
      (zSum / n > 0 ? back : front).push(chunk);
    }
  };

  const tracePath = (poly: number[], ox = 0, oy = 0) => {
    ctx.beginPath();
    ctx.moveTo(poly[0] + ox, poly[1] + oy);
    for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i] + ox, poly[i + 1] + oy);
  };

  const strokeChunks = (list: Chunk[]) => {
    if (list.length === 0) return;

    // мягкая подложка пучка — на неё ложится общий bloom-проход
    if (canFilter) {
      ctx.filter = `blur(${6 * dpr}px)`;
      for (const c of list) {
        ctx.strokeStyle = rgba(ACCENT, c.alpha * 0.3);
        ctx.lineWidth = c.width * 7;
        tracePath(c.pts);
        ctx.stroke();
      }
      ctx.filter = "none";
    }

    // тело и ядро — по каждой нити пучка, дальние нити слабее
    for (let s = 0; s < STRANDS.length; s++) {
      const weight = s === 0 ? 1 : 0.5 - s * 0.08;
      for (const c of list) {
        // у гаснущего хвоста лишние нити всё равно не видны — не тратим на них кадр
        if (s > 0 && c.alpha < 0.12) continue;
        const ox = c.nx * STRANDS[s] * c.width;
        const oy = c.ny * STRANDS[s] * c.width;
        ctx.strokeStyle = rgba(ACCENT, c.alpha * 0.42 * weight);
        ctx.lineWidth = c.width * 2;
        tracePath(c.pts, ox, oy);
        ctx.stroke();
        ctx.strokeStyle = rgba(CORE, c.alpha * 0.5 * weight);
        ctx.lineWidth = c.width * 0.7;
        tracePath(c.pts, ox, oy);
        ctx.stroke();
      }
    }
  };

  const drawHead = (x: number, y: number, scale: number, a: number) => {
    const r = 2.6 * scale;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    glow.addColorStop(0, rgba(CORE, Math.min(1, a)));
    glow.addColorStop(0.18, rgba(ACCENT, a * 0.5));
    glow.addColorStop(1, rgba(ACCENT, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(CORE, Math.min(1, a * 1.1));
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  };

  const TRAIL_LIFE = 2.4;

  const step = (dt: number) => {
    age += dt;
    // пока дрон в эмблеме, следов не пишем — иначе копятся точки в центре
    const flying = isIntro(age) ? age < INTRO_END - 0.15 : loopTimeAt(age) < ARRIVE + 0.1;

    for (const o of orbits) {
      o.angle += o.spec.speed * dt;

      if (flying && (o.lastSample < 0 || age - o.lastSample >= SAMPLE)) {
        o.lastSample = age;
        const p = positionAt(o, age);
        o.trail.push({ x: p.x, y: p.y, z: p.z, s: p.s, t: age });
      }
      while (o.trail.length > 0 && age - o.trail[0].t > TRAIL_LIFE) o.trail.shift();
    }

    px += (targetPX - px) * Math.min(1, dt * 3);
    py += (targetPY - py) * Math.min(1, dt * 3);
  };

  /** Копии дрона за время выдержки — из них складывается смаз движения. */
  const collectDroneSamples = (o: Orbit, alpha: number, droneSize: number): DroneSample[] => {
    const out: DroneSample[] = [];
    for (let i = 0; i < SUBFRAMES; i++) {
      const lag = (i / (SUBFRAMES - 1)) * EXPOSURE;
      const t = age - lag;
      if (t < 0) continue;

      const p = positionAt(o, t);

      out.push({
        x: p.x + px * 0.6,
        y: p.y + py * 0.6,
        scale: droneSize * p.s,
        heading: p.heading,
        alpha: alpha * SUB_WEIGHTS[i],
        z: p.z,
        spin: t * 26,
        fresh: i === 0,
      });
    }
    return out;
  };

  /** Bloom: уменьшенная размытая копия кадра, добавленная поверх него. */
  const applyBloom = () => {
    if (!canFilter || bloomCanvas.width < 2) return;
    const bc = bloomCanvas.getContext("2d");
    if (!bc) return;

    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
    bc.filter = `blur(${BLOOM_BLUR}px)`;
    bc.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
    bc.filter = "none";

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // bloom кладём в пикселях устройства
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = BLOOM_GAIN;
    ctx.drawImage(bloomCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  /**
   * Гасит слой там, где он мешает тексту. Работает только после интро: пока
   * дрон облетает надпись, он должен быть виден и над ней.
   *
   * Два уровня. Общий градиент слева убирает разлив свечения по фону колонки,
   * а щиты — прямоугольники реальных строк из DOM — гасят почти в ноль ровно
   * тот участок, где стоят буквы. Из-за размытия край щита мягкий, поэтому
   * выреза в свечении не видно.
   */
  const maskTextColumn = (strength: number) => {
    if (strength < 0.01) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "destination-out";

    if (maskEdge >= 0.05) {
      const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
      g.addColorStop(0, `rgba(0,0,0,${(0.72 * strength).toFixed(3)})`);
      g.addColorStop(maskEdge * 0.55, `rgba(0,0,0,${(0.6 * strength).toFixed(3)})`);
      g.addColorStop(maskEdge * 0.85, `rgba(0,0,0,${(0.24 * strength).toFixed(3)})`);
      g.addColorStop(maskEdge, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (shields.length > 0) {
      // Пятно, а не прямоугольник: у прямоугольного щита видно ровную границу
      // обрезанного свечения. Градиент от центра к краю плюс размытие делают
      // переход незаметным.
      ctx.filter = canFilter ? `blur(${10 * dpr}px)` : "none";
      for (const box of shields) {
        const midX = (box.x + box.w / 2) * dpr;
        const midY = (box.y + box.h / 2) * dpr;
        const rx = (box.w / 2 + 34) * dpr;
        const ry = (box.h / 2 + 20) * dpr;

        ctx.save();
        ctx.translate(midX, midY);
        ctx.scale(rx, ry);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, `rgba(0,0,0,${(0.97 * strength).toFixed(3)})`);
        g.addColorStop(0.55, `rgba(0,0,0,${(0.92 * strength).toFixed(3)})`);
        g.addColorStop(0.8, `rgba(0,0,0,${(0.55 * strength).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.filter = "none";
    }

    ctx.restore();
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // вспышка в момент, когда дрон входит в эмблему (в интро — свой момент)
    const t = isIntro(age) ? age : loopTimeAt(age);
    const arriveAt = isIntro(age) ? INTRO_END : ARRIVE;
    const flash = Math.exp(-(((t - arriveAt) / FLASH_SIGMA) ** 2));
    // первое разгорание — с парой срывов, как у настоящей неоновой трубки;
    // дальше эмблема горит всегда, слегка притухая на время пролёта
    const ignite = smoothstep(EMBLEM_FIRST[0], EMBLEM_FIRST[1], age);
    const flicker =
      age < EMBLEM_FIRST[1] ? 0.5 + 0.5 * Math.abs(Math.sin(age * 21)) : 0.96 + 0.04 * Math.sin(age * 1.6);
    const idle = 0.78 + 0.22 * smoothstep(arriveAt - 0.4, arriveAt + 0.3, t);
    const emblemAlpha = Math.min(1.15, ignite * flicker * idle + flash * 0.5) * sceneAlpha;
    const nameAlpha = smoothstep(NAME_IN[0], NAME_IN[1], age) * idle * sceneAlpha;

    // дрон виден только на пролёте: проявляется на вылете, гаснет, войдя в эмблему
    const droneAlpha = isIntro(age)
      ? smoothstep(0, 0.45, age) * (1 - smoothstep(INTRO_FADE[0], INTRO_FADE[1], age)) * sceneAlpha
      : smoothstep(FLY_OUT[0], FLY_OUT[0] + 0.35, t) *
        (1 - smoothstep(DRONE_FADE[0], DRONE_FADE[1], t)) *
        sceneAlpha;

    back.length = 0;
    front.length = 0;
    const samples: DroneSample[] = [];
    const heads: Array<{ x: number; y: number; s: number; a: number; z: number }> = [];
    const droneSize = emblemR * 0.46;

    for (const o of orbits) {
      buildChunks(o, TRAIL_LIFE, 1);

      if (o.spec.drone) {
        if (droneAlpha > 0.01) samples.push(...collectDroneSamples(o, droneAlpha, droneSize));
        continue;
      }

      const p = positionAt(o, age);
      heads.push({
        x: p.x + px * 0.6,
        y: p.y + py * 0.6,
        s: p.s,
        a: o.spec.alpha * droneAlpha,
        z: p.z,
      });
    }

    strokeChunks(back);
    for (const hd of heads) if (hd.z > 0) drawHead(hd.x, hd.y, hd.s, hd.a);
    for (const s of samples) {
      if (s.z > 0) drawDrone(ctx, s.x, s.y, s.scale, s.heading, s.alpha, s.spin, s.fresh);
    }

    if (emblemAlpha > 0.002 && emblemCanvas.width > 0) {
      const size = emblemCanvas.width / dpr;
      const ox = cx + px * 0.35 - size / 2;
      const oy = cy + py * 0.35 - size / 2;
      const floor = cy + py * 0.35 + emblemR; // «пол», от которого идёт отражение

      // блик на глянцевом полу под эмблемой
      const pool = ctx.createRadialGradient(cx + px * 0.35, floor, 0, cx + px * 0.35, floor, emblemR * 1.6);
      pool.addColorStop(0, rgba(ACCENT, 0.16 * emblemAlpha));
      pool.addColorStop(1, rgba(ACCENT, 0));
      ctx.save();
      ctx.translate(0, floor);
      ctx.scale(1, 0.32);
      ctx.translate(0, -floor);
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(cx + px * 0.35, floor, emblemR * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalAlpha = emblemAlpha * 0.26;
      ctx.drawImage(
        reflectCanvas,
        ox,
        floor - reflectTop + emblemR * 0.06,
        size,
        reflectCanvas.height / dpr,
      );
      ctx.globalAlpha = emblemAlpha;
      ctx.drawImage(emblemCanvas, ox, oy, size, size);
      ctx.globalAlpha = 1;
    }

    // имя внутри эмблемы
    if (nameAlpha > 0.01) {
      const nx = cx + px * 0.35;
      const ny = cy + py * 0.35;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${(emblemR * 0.17).toFixed(1)}px ${fontFamily}`;
      if (canFilter) {
        ctx.filter = `blur(${6 * dpr}px)`;
        ctx.fillStyle = rgba(ACCENT, nameAlpha * 0.7);
        ctx.fillText(NAME, nx, ny);
        ctx.filter = "none";
      }
      ctx.fillStyle = rgba(CORE, nameAlpha);
      ctx.fillText(NAME, nx, ny);
    }

    // вспышка в момент входа дрона в эмблему
    if (flash > 0.01) {
      const fx = cx + px * 0.35;
      const fy = cy + py * 0.35;
      const burst = ctx.createRadialGradient(fx, fy, 0, fx, fy, emblemR * 2.2);
      burst.addColorStop(0, rgba(CORE, flash * 0.5 * sceneAlpha));
      burst.addColorStop(0.25, rgba(ACCENT, flash * 0.22 * sceneAlpha));
      burst.addColorStop(1, rgba(ACCENT, 0));
      ctx.fillStyle = burst;
      ctx.beginPath();
      ctx.arc(fx, fy, emblemR * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    strokeChunks(front);
    for (const hd of heads) if (hd.z <= 0) drawHead(hd.x, hd.y, hd.s, hd.a);
    for (const s of samples) {
      if (s.z <= 0) drawDrone(ctx, s.x, s.y, s.scale, s.heading, s.alpha, s.spin, s.fresh);
    }

    applyBloom();
    maskTextColumn(smoothstep(MASK_IN[0], MASK_IN[1], age));
    ctx.globalCompositeOperation = "source-over";
  };

  return {
    resize,
    step,
    draw,
    setPointer(nx: number, ny: number) {
      targetPX = (nx - 0.5) * 22;
      targetPY = (ny - 0.5) * 14;
    },
    setShields(boxes: Shield[]) {
      shields = boxes;
    },
    seek(seconds: number) {
      age = 0;
      px = targetPX;
      py = targetPY;
      for (const o of orbits) {
        o.angle = o.spec.phase;
        o.trail.length = 0;
        o.lastSample = -1;
      }
      const dt = 1 / 60;
      for (let t = 0; t < seconds; t += dt) step(dt);
    },
    age: () => age,
  };
}
