// ============================================================================
//  НАСТРОЙКИ МАГАЗИНА
//  Всё, что нужно поменять под свой бренд, находится в этом файле:
//  название, контакты, цены, доступные варианты изделий.
// ============================================================================

export const BRAND = {
  name: 'Atelier',                 // название бренда (в шапке и в заявке)
  tagline: 'Украшения с бриллиантами на заказ',
  currency: '₸',
  locale: 'ru-KZ',
  // Номера WhatsApp в международном формате без "+" (ЗАМЕНИТЕ на свои)
  cities: [
    { id: 'almaty', label: 'Алматы', whatsapp: '77000000000' },
    { id: 'astana', label: 'Астана', whatsapp: '77000000001' },
  ],
  instagram: '',                   // например 'https://www.instagram.com/yourbrand/'
};

// Формы бриллианта. id используется в геометрии (js/shapes.js).
export const SHAPES = [
  { id: 'round',    label: 'Круг' },
  { id: 'oval',     label: 'Овал' },
  { id: 'princess', label: 'Принцесса' },
  { id: 'cushion',  label: 'Кушон' },
  { id: 'emerald',  label: 'Изумруд' },
  { id: 'asscher',  label: 'Ашер' },
  { id: 'radiant',  label: 'Радиант' },
  { id: 'pear',     label: 'Груша' },
  { id: 'marquise', label: 'Маркиз' },
  { id: 'heart',    label: 'Сердце' },
];

// Модели шинки (ободка кольца). price — базовая цена кольца с камнем 1 ct.
export const SHANKS = [
  { id: 'classic', label: 'Classic', note: 'Гладкая округлая шинка',     price: 690000 },
  { id: 'slim',    label: 'Slim',    note: 'Тонкая изящная шинка',        price: 640000 },
  { id: 'knife',   label: 'Knife',   note: 'Острое ребро сверху',         price: 720000 },
  { id: 'pave',    label: 'Pavé',    note: 'Дорожка из камней',           price: 840000 },
  { id: 'twist',   label: 'Twist',   note: 'Две переплетённые нити',      price: 790000 },
];

// Касты (крепление центрального камня). price — доплата.
export const SETTINGS = [
  { id: 'prong', label: 'Крапана',  note: 'Классические лапки',          price: 0 },
  { id: 'halo',  label: 'Halo',     note: 'Ореол из мелких камней',      price: 180000 },
  { id: 'bezel', label: 'Bezel',    note: 'Сплошной металлический обод', price: 60000 },
];

// Формы, недоступные для определённой касты (пусто — доступны все)
export const SETTING_SHAPES = {
  halo: ['round', 'oval', 'pear', 'marquise', 'emerald', 'radiant', 'cushion', 'princess'],
};

export const METALS = [
  { id: 'white',  label: 'Белое золото',   color: '#d9dde3' },
  { id: 'yellow', label: 'Жёлтое золото',  color: '#e3b45b' },
  { id: 'rose',   label: 'Розовое золото', color: '#e3a48b' },
];

export const PURITIES = [
  { id: '585', label: '585 · 14K', price: 0 },
  { id: '750', label: '750 · 18K', price: 95000 },
];

export const STONE_COLORS = [
  { id: 'white',  label: 'Белый',      color: '#ffffff', fancy: false },
  { id: 'yellow', label: 'Жёлтый',     color: '#ffd84a', fancy: true },
  { id: 'pink',   label: 'Розовый',    color: '#ff9fc4', fancy: true },
  { id: 'blue',   label: 'Синий',      color: '#4f8dff', fancy: true },
  { id: 'green',  label: 'Зелёный',    color: '#45d68a', fancy: true },
  { id: 'black',  label: 'Чёрный',     color: '#2a2a2e', fancy: true },
];

export const CARATS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
export const RING_SIZES = [15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 21];

// Пусеты (серьги-гвоздики). price — цена пары с камнями по 1 ct.
export const STUD_SETTINGS = [
  { id: 'prong', label: 'Classic', price: 980000 },
  { id: 'halo',  label: 'Halo',    price: 1240000 },
  { id: 'bezel', label: 'Bezel',   price: 1060000 },
];

export const PRICING = {
  caratPrice: 520000,          // за каждый карат сверх 1 ct (меньше 1 ct — скидка)
  minPriceFactor: 0.55,        // нижняя граница цены относительно базы
  fancyColorPerCarat: 120000,  // доплата за цветной центральный камень, за 1 ct
  fancySide: 70000,            // доплата за цветные боковые камни
};

export const DEFAULTS = {
  shape: 'round', shank: 'classic', setting: 'prong', carat: 1,
  metal: 'white', head: 'same', purity: '585', gem1: 'white', gem2: 'white', size: 17,
};
